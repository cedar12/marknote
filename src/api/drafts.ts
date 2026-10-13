import { invoke, isTauri } from '@tauri-apps/api/core';
import { BrowserDraftRepository, DRAFT_OWNER_PREFIX, type DraftRepository, type DraftSnapshot, type DraftSummary } from '../utils/draftRecovery';

const OWNER_LOCK_PREFIX = 'marknote-draft-owner:';
let browserRepository: DraftRepository | undefined;
let releaseOwnerLock: (() => void) | undefined;
let lockedOwner: string | undefined;

function releaseBrowserOwnerLock() {
  const release = releaseOwnerLock;
  releaseOwnerLock = undefined;
  lockedOwner = undefined;
  release?.();
}

export function createDraftRepository(): DraftRepository {
  if (isTauri()) return {
    register: owner => invoke('draft_register', { owner }),
    list: () => invoke<DraftSummary[]>('draft_list'),
    write: draft => invoke('draft_write', { draft }),
    claim: (id, owner) => invoke<DraftSnapshot>('draft_claim', { id, owner }),
    remove: (id, owner) => invoke('draft_remove', { id, owner }),
  };
  if (browserRepository) return browserRepository;
  const locks = navigator.locks;
  const local = new BrowserDraftRepository(localStorage, Date.now,
    locks ? async () => new Set((await locks.query()).held?.map(lock => lock.name || '')
      .filter(name => name.startsWith(OWNER_LOCK_PREFIX)).map(name => name.slice(OWNER_LOCK_PREFIX.length))) : undefined,
    locks ? (name, work) => locks.request(name, { mode: 'exclusive' }, work) : undefined);
  browserRepository = {
    async register(owner) {
      // A reload releases its Web Lock. The lease fallback clears only this tab's previous owner.
      const previous = sessionStorage.getItem('marknoteDraftOwner');
      if (previous) localStorage.removeItem(DRAFT_OWNER_PREFIX + previous);
      sessionStorage.setItem('marknoteDraftOwner', owner);
      try {
        if (locks && lockedOwner !== owner) {
          releaseBrowserOwnerLock();
          await new Promise<void>((resolve, reject) => {
            void locks.request(OWNER_LOCK_PREFIX + owner, async () => {
              lockedOwner = owner;
              const lifetime = new Promise<void>(release => { releaseOwnerLock = release; });
              resolve();
              await lifetime;
            }).catch(reject);
          });
        }
        await local.register(owner);
      } catch {
        // Registration failure must release its lifetime lock before offering
        // Retry; otherwise a retry would wait forever behind this same tab.
        if (lockedOwner === owner) releaseBrowserOwnerLock();
        throw new Error('draft_registration_failed');
      }
    },
    list: () => local.list(), write: draft => local.write(draft), claim: (id, owner) => local.claim(id, owner),
    remove: (id, owner) => local.remove(id, owner), heartbeat: owner => local.heartbeat(owner),
    release(owner) { if (lockedOwner === owner) releaseBrowserOwnerLock(); local.release(owner); },
  };
  return browserRepository;
}
