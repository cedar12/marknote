export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_MAX_BYTES = 128 * 1024 * 1024;
export const DRAFT_LEASE_MS = 60_000;
export const DRAFT_PREFIX = 'marknote.draft.';
export const DRAFT_OWNER_PREFIX = 'marknote.draft-owner.';

export interface DraftSnapshot {
  schemaVersion: 1;
  id: string;
  owner: string;
  title: string;
  sourcePath: string | null;
  markdown: string;
  updatedAt: number;
}

export type DraftSummary = Omit<DraftSnapshot, 'markdown' | 'owner' | 'schemaVersion'> & { bytes: number };

export interface DraftRepository {
  register(owner: string): Promise<void>;
  list(): Promise<DraftSummary[]>;
  write(draft: DraftSnapshot): Promise<void>;
  claim(id: string, owner: string): Promise<DraftSnapshot>;
  remove(id: string, owner: string): Promise<void>;
  heartbeat?(owner: string): Promise<void>;
  release?(owner: string): void;
}

export interface DraftStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function validDraftId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}

export function draftByteLength(markdown: string): number {
  return new TextEncoder().encode(markdown).byteLength;
}

export function parseDraft(value: unknown): DraftSnapshot {
  if (!value || typeof value !== 'object') throw new Error('invalid_draft');
  const draft = value as DraftSnapshot;
  if (draft.schemaVersion !== DRAFT_SCHEMA_VERSION || !validDraftId(draft.id) || !validDraftId(draft.owner)
    || typeof draft.title !== 'string' || draft.title.length > 1024
    || (draft.sourcePath !== null && (typeof draft.sourcePath !== 'string' || draft.sourcePath.length > 32768))
    || typeof draft.markdown !== 'string' || draftByteLength(draft.markdown) > DRAFT_MAX_BYTES
    || !Number.isSafeInteger(draft.updatedAt) || draft.updatedAt <= 0) throw new Error('invalid_draft');
  return { schemaVersion: 1, id: draft.id, owner: draft.owner, title: draft.title,
    sourcePath: draft.sourcePath, markdown: draft.markdown, updatedAt: draft.updatedAt };
}

export function summarizeDraft(draft: DraftSnapshot): DraftSummary {
  return { id: draft.id, title: draft.title, sourcePath: draft.sourcePath,
    updatedAt: draft.updatedAt, bytes: draftByteLength(draft.markdown) };
}

type Exclusive = <T>(name: string, work: () => Promise<T>) => Promise<T>;

// The preview stores each document separately. Never rewrite a shared drafts array:
// another window may be persisting its own unsaved document at the same time.
export class BrowserDraftRepository implements DraftRepository {
  constructor(private storage: DraftStorage, private now: () => number = Date.now,
    private activeOwners?: () => Promise<Set<string>>, private exclusive?: Exclusive) {}

  async register(owner: string): Promise<void> { await this.heartbeat(owner); }

  async heartbeat(owner: string): Promise<void> {
    if (!validDraftId(owner)) throw new Error('invalid_owner');
    this.storage.setItem(DRAFT_OWNER_PREFIX + owner, String(this.now() + DRAFT_LEASE_MS));
  }

  release(owner: string): void { this.storage.removeItem(DRAFT_OWNER_PREFIX + owner); }

  private async isActive(owner: string): Promise<boolean> {
    if (this.activeOwners) return (await this.activeOwners()).has(owner);
    return Number(this.storage.getItem(DRAFT_OWNER_PREFIX + owner) || 0) > this.now();
  }

  private async locked<T>(id: string, work: () => Promise<T>): Promise<T> {
    if (!validDraftId(id)) throw new Error('invalid_draft');
    return this.exclusive ? this.exclusive('marknote-draft-record:' + id, work) : work();
  }

  private read(id: string): DraftSnapshot {
    const value = this.storage.getItem(DRAFT_PREFIX + id);
    if (value === null) throw new Error('draft_not_found');
    const draft = parseDraft(JSON.parse(value));
    if (draft.id !== id) throw new Error('invalid_draft');
    return draft;
  }

  async list(): Promise<DraftSummary[]> {
    const drafts: DraftSummary[] = [];
    const keys = Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index));
    for (const key of keys) {
      if (!key?.startsWith(DRAFT_PREFIX) || !validDraftId(key.slice(DRAFT_PREFIX.length))) continue;
      // A corrupt record remains in storage for diagnosis; it must not hide healthy drafts.
      let draft: DraftSnapshot;
      try { draft = this.read(key.slice(DRAFT_PREFIX.length)); } catch { continue; }
      if (!await this.isActive(draft.owner)) drafts.push(summarizeDraft(draft));
    }
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async write(value: DraftSnapshot): Promise<void> {
    const draft = parseDraft(value);
    await this.locked(draft.id, async () => {
      const previous = this.storage.getItem(DRAFT_PREFIX + draft.id);
      if (previous !== null && this.read(draft.id).owner !== draft.owner) throw new Error('draft_in_use');
      this.storage.setItem(DRAFT_PREFIX + draft.id, JSON.stringify(draft));
    });
  }

  async claim(id: string, owner: string): Promise<DraftSnapshot> {
    if (!validDraftId(owner)) throw new Error('invalid_owner');
    return this.locked(id, async () => {
      const draft = this.read(id);
      if (draft.owner !== owner && await this.isActive(draft.owner)) throw new Error('draft_in_use');
      const claimed = { ...draft, owner, updatedAt: this.now() };
      this.storage.setItem(DRAFT_PREFIX + id, JSON.stringify(claimed));
      return claimed;
    });
  }

  async remove(id: string, owner: string): Promise<void> {
    await this.locked(id, async () => {
      if (this.storage.getItem(DRAFT_PREFIX + id) === null) return;
      const draft = this.read(id);
      if (draft.owner !== owner && await this.isActive(draft.owner)) throw new Error('draft_in_use');
      this.storage.removeItem(DRAFT_PREFIX + id);
    });
  }
}
