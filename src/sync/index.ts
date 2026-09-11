import { createSyncAdapter } from './adapter';
import { DexieSyncStore, SyncQueue } from './queue';
import { SyncRepositoryObserver } from './repository-observer';

export * from './adapter';
export * from './queue';
export * from './repository-observer';
export * from './types';

export const syncAdapter = createSyncAdapter();
export const syncStore = new DexieSyncStore();
export const syncQueue = new SyncQueue(syncStore, syncAdapter);
export const syncRepositoryObserver = new SyncRepositoryObserver(syncQueue, syncAdapter);
