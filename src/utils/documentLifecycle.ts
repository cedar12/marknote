import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getAllWindows, getCurrentWindow } from '@tauri-apps/api/window';

const REQUEST_EVENT = 'marknote-document-lifecycle-request';
const RESPONSE_EVENT = 'marknote-document-lifecycle-response';
type Phase = 'prepare' | 'validate' | 'keepalive' | 'release';
export type LifecycleFailure = 'busy' | 'cancelled' | 'changed' | 'timeout' | 'unavailable';
export interface LifecycleDecision { allowed: boolean; reason?: LifecycleFailure }
interface Request { id: string; owner: string; phase: Phase; committed?: boolean }
interface Response extends LifecycleDecision { id: string; label: string; phase: 'prepare' | 'validate' }

export interface LifecycleParticipant {
  prepare(id: string): Promise<LifecycleDecision>;
  validate(id: string): boolean;
  release(id: string, resume?: boolean): void;
}

export interface LifecycleTransport {
  label: string;
  getWindowLabels(): Promise<string[]>;
  onRequest(handler: (request: Request) => void): Promise<UnlistenFn>;
  onResponse(handler: (response: Response) => void): Promise<UnlistenFn>;
  sendRequest(label: string, request: Request): Promise<void>;
  sendResponse(label: string, response: Response): Promise<void>;
}

export function isDocumentWindow(label: string): boolean {
  return label === 'main' || /^window_\d+$/.test(label);
}

/** Downloading keeps documents editable; the approval protects installation and restart. */
export async function installUpdateSafely(
  update: { download(): Promise<void>; install(): Promise<void> },
  protect: (action: () => Promise<void>) => Promise<boolean>,
  restart: () => Promise<void>,
): Promise<boolean> {
  await update.download();
  return protect(async () => {
    await update.install();
    await restart();
  });
}

/** Two-phase, label-addressed approval. A missing window never counts as approval. */
export function createDocumentLifecycle(
  transport: LifecycleTransport,
  participant: LifecycleParticipant,
  options: { requestTimeoutMs?: number; leaseMs?: number; onFailure?: (reason: LifecycleFailure) => void } = {},
) {
  const timeoutMs = options.requestTimeoutMs ?? 120_000;
  const leaseMs = options.leaseMs ?? 20_000;
  let listeners: UnlistenFn[] = [];
  let starting: Promise<void> | null = null;
  let running = false;
  let sequence = 0;
  let session: { id: string; owner: string; prepared: boolean } | null = null;
  let leaseTimer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Map<string, { resolve: (response: Response) => void; timer: ReturnType<typeof setTimeout> }>();

  async function bounded<T>(operation: Promise<T>, delay = timeoutMs): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('document lifecycle operation timed out')), delay);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }

  function release(id: string, resume = true) {
    if (session?.id !== id) return;
    if (leaseTimer) clearTimeout(leaseTimer);
    leaseTimer = null;
    session = null;
    participant.release(id, resume);
  }

  function renewLease(id: string) {
    if (leaseTimer) clearTimeout(leaseTimer);
    leaseTimer = setTimeout(() => release(id), leaseMs);
  }

  function validRequest(value: Request): boolean {
    return !!value && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 200
      && isDocumentWindow(value.owner) && ['prepare', 'validate', 'keepalive', 'release'].includes(value.phase);
  }

  async function receive(request: Request) {
    if (!validRequest(request)) return;
    const { id, owner, phase } = request;
    if (phase === 'release' || phase === 'keepalive') {
      if (session?.id === id && session.owner === owner) {
        if (phase === 'release') release(id, request.committed !== true);
        else renewLease(id);
      }
      return;
    }
    let decision: LifecycleDecision = { allowed: false, reason: 'busy' };
    if (phase === 'prepare' && !session) {
      session = { id, owner, prepared: false };
      renewLease(id);
      try {
        decision = await participant.prepare(id);
      } catch {
        decision = { allowed: false, reason: 'unavailable' };
      }
      // A timed-out or abandoned request cannot regain ownership after its dialog completes.
      if (session?.id !== id || session.owner !== owner) {
        decision = { allowed: false, reason: 'cancelled' };
      } else if (decision.allowed) {
        session.prepared = true;
        renewLease(id);
      } else release(id);
    } else if (phase === 'validate') {
      decision = session?.id === id && session.owner === owner && session.prepared && participant.validate(id)
        ? { allowed: true }
        : { allowed: false, reason: 'changed' };
    }
    await transport.sendResponse(owner, { id, label: transport.label, phase, ...decision });
  }

  function start(): Promise<void> {
    if (starting) return starting;
    starting = (async () => {
      try {
        listeners.push(await transport.onRequest(request => { void receive(request).catch(() => {}); }));
        listeners.push(await transport.onResponse(response => {
          if (!response || typeof response.label !== 'string' || typeof response.id !== 'string'
            || !['prepare', 'validate'].includes(response.phase) || typeof response.allowed !== 'boolean') return;
          const key = `${response.id}:${response.phase}:${response.label}`;
          const waiter = pending.get(key);
          if (!waiter) return;
          clearTimeout(waiter.timer);
          pending.delete(key);
          waiter.resolve(response);
        }));
      } catch (error) {
        listeners.splice(0).forEach(unlisten => unlisten());
        starting = null;
        throw error;
      }
    })();
    return starting;
  }

  function requestApproval(label: string, request: Request): Promise<Response> {
    const phase = request.phase as 'prepare' | 'validate';
    const key = `${request.id}:${phase}:${label}`;
    return new Promise(resolve => {
      function finish(reason: LifecycleFailure) {
        const waiter = pending.get(key);
        if (!waiter) return;
        clearTimeout(waiter.timer);
        pending.delete(key);
        resolve({ id: request.id, label, phase, allowed: false, reason });
      }
      const timer = setTimeout(() => finish('timeout'), timeoutMs);
      pending.set(key, { resolve, timer });
      void transport.sendRequest(label, request).catch(() => finish('unavailable'));
    });
  }

  async function documentLabels(): Promise<string[]> {
    return [...new Set((await bounded(transport.getWindowLabels())).filter(isDocumentWindow))].sort();
  }

  async function run(action: () => Promise<void>, beforeValidation?: () => Promise<void>): Promise<boolean> {
    if (running || session) {
      options.onFailure?.('busy');
      return false;
    }
    running = true;
    const id = `${transport.label}-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
    let labels: string[] = [];
    let committed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      await start();
      labels = await documentLabels();
      if (!labels.includes(transport.label)) throw new Error('initiating document window is unavailable');
      heartbeat = setInterval(() => {
        for (const label of labels) {
          void transport.sendRequest(label, { id, owner: transport.label, phase: 'keepalive' }).catch(() => {});
        }
      }, Math.max(10, Math.floor(leaseMs / 4)));
      // Check the initiating document first. Other windows then present one native dialog at a time.
      const ordered = [transport.label, ...labels.filter(label => label !== transport.label)];
      for (const label of ordered) {
        const answer = await requestApproval(label, { id, owner: transport.label, phase: 'prepare' });
        if (!answer.allowed) {
          if (answer.reason !== 'cancelled') options.onFailure?.(answer.reason || 'unavailable');
          return false;
        }
      }
      // Persist harmless window preferences after approval, then validate every
      // document again so asynchronous preparation cannot weaken exit protection.
      await beforeValidation?.();
      if (JSON.stringify(labels) !== JSON.stringify(await documentLabels())) {
        options.onFailure?.('changed');
        return false;
      }
      const confirmations = await Promise.all(labels.map(label =>
        requestApproval(label, { id, owner: transport.label, phase: 'validate' })));
      const rejected = confirmations.find(answer => !answer.allowed);
      if (rejected || JSON.stringify(labels) !== JSON.stringify(await documentLabels())) {
        options.onFailure?.(rejected?.reason || 'changed');
        return false;
      }
      await action();
      committed = true;
      return true;
    } catch (error) {
      options.onFailure?.('unavailable');
      throw error;
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      // Failed delivery is bounded by the participant lease, including a crashed initiating window.
      await bounded(Promise.allSettled(labels.map(label =>
        transport.sendRequest(label, { id, owner: transport.label, phase: 'release', committed }))), Math.min(1000, timeoutMs)).catch(() => {});
      release(id, !committed);
      running = false;
    }
  }

  function dispose() {
    listeners.splice(0).forEach(unlisten => unlisten());
    starting = null;
    if (session) release(session.id);
    for (const [key, waiter] of pending) {
      clearTimeout(waiter.timer);
      const [id, phase, label] = key.split(':');
      waiter.resolve({ id, label, phase: phase as 'prepare' | 'validate', allowed: false, reason: 'cancelled' });
    }
    pending.clear();
  }

  return { start, run, dispose };
}

export function createNativeDocumentLifecycle(participant: LifecycleParticipant, onFailure: (reason: LifecycleFailure) => void) {
  const label = getCurrentWindow().label;
  return createDocumentLifecycle({
    label,
    getWindowLabels: async () => (await getAllWindows()).map(window => window.label),
    onRequest: handler => listen<Request>(REQUEST_EVENT, event => handler(event.payload), { target: { kind: 'Window', label } }),
    onResponse: handler => listen<Response>(RESPONSE_EVENT, event => handler(event.payload), { target: { kind: 'Window', label } }),
    sendRequest: (target, request) => emitTo({ kind: 'Window', label: target }, REQUEST_EVENT, request),
    sendResponse: (target, response) => emitTo({ kind: 'Window', label: target }, RESPONSE_EVENT, response),
  }, participant, { onFailure });
}
