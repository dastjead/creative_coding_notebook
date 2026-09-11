import Dexie, { type EntityTable } from 'dexie';
import type { EnqueueSyncOperation, SyncAdapter, SyncChannel, SyncOperation, SyncOperationStore } from './types';

export class MemorySyncStore implements SyncOperationStore {
  private readonly operations = new Map<string, SyncOperation>();

  async put(operation: SyncOperation) {
    this.operations.set(operation.id, structuredClone(operation));
  }

  async list() {
    return [...this.operations.values()].map((operation) => structuredClone(operation));
  }
}

class SyncDatabase extends Dexie {
  operations!: EntityTable<SyncOperation, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ operations: 'id, state, channel, projectId, createdAt, clientMutationId' });
  }
}

export class DexieSyncStore implements SyncOperationStore {
  private readonly db: SyncDatabase;

  constructor(name = 'creative-coding-notebook-sync') {
    this.db = new SyncDatabase(name);
  }

  async put(operation: SyncOperation) {
    await this.db.operations.put(operation);
  }

  list() {
    return this.db.operations.orderBy('createdAt').toArray();
  }
}

export class SyncQueue {
  private flushTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: SyncOperationStore,
    private readonly adapter: SyncAdapter,
  ) {}

  async enqueue(input: EnqueueSyncOperation): Promise<SyncOperation> {
    const id = newId();
    const now = new Date().toISOString();
    const operation: SyncOperation = {
      ...input,
      id,
      clientMutationId: id,
      state: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.put(operation);
    return operation;
  }

  flush(): Promise<void> {
    const next = this.flushTail.then(() => this.flushOnce());
    this.flushTail = next.catch(() => undefined);
    return next;
  }

  private async flushOnce(): Promise<void> {
    if (!this.adapter.enabled) return;
    const operations = (await this.store.list()).filter((operation) => operation.state === 'pending');
    await Promise.all([
      this.flushChannel(operations, 'metadata'),
      this.flushChannel(operations, 'media'),
    ]);
  }

  private async flushChannel(operations: SyncOperation[], channel: SyncChannel) {
    const latestServerRevision = new Map<string, number>();
    for (const item of await this.store.list()) {
      if (item.channel === 'metadata' && item.state === 'applied' && item.serverRevision !== undefined) {
        latestServerRevision.set(item.projectId, Math.max(latestServerRevision.get(item.projectId) ?? 0, item.serverRevision));
      }
    }
    for (const operation of operations.filter((item) => item.channel === channel)) {
      const effectiveOperation = operation.channel === 'metadata' && operation.baseServerRevision === undefined
        && latestServerRevision.has(operation.projectId)
        ? { ...operation, baseServerRevision: latestServerRevision.get(operation.projectId) }
        : operation;
      try {
        const result = await this.adapter.push(effectiveOperation);
        if (result.status === 'disabled') continue;
        if (result.status === 'conflict') {
          await this.store.put({
            ...effectiveOperation,
            state: 'conflict',
            attempts: operation.attempts + 1,
            updatedAt: new Date().toISOString(),
            conflict: { serverRevision: result.serverRevision, remotePayload: result.remotePayload },
          });
          continue;
        }
        if (channel === 'metadata' && result.serverRevision !== undefined) {
          latestServerRevision.set(operation.projectId, result.serverRevision);
        }
        await this.store.put({
          ...effectiveOperation,
          state: 'applied',
          attempts: operation.attempts + 1,
          serverRevision: result.serverRevision,
          lastError: undefined,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        await this.store.put({
          ...effectiveOperation,
          attempts: operation.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
