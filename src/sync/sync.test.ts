// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSyncAdapter, DisabledSyncAdapter } from './adapter';
import { MemorySyncStore, SyncQueue } from './queue';
import type { SyncAdapter, SyncOperation, SyncResult } from './types';

class ControlledAdapter implements SyncAdapter {
  readonly enabled = true;

  constructor(private readonly apply: (operation: SyncOperation) => Promise<SyncResult>) {}

  signInMagicLink(): Promise<void> {
    return Promise.resolve();
  }

  push(operation: SyncOperation): Promise<SyncResult> {
    return this.apply(operation);
  }
}

describe('optional sync boundary', () => {
  it('stays disabled when browser-safe Supabase settings are missing', () => {
    expect(createSyncAdapter({})).toBeInstanceOf(DisabledSyncAdapter);
    expect(createSyncAdapter({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toBeInstanceOf(DisabledSyncAdapter);
  });

  it('syncs metadata even when a media upload fails', async () => {
    const store = new MemorySyncStore();
    const queue = new SyncQueue(store, new ControlledAdapter(async (operation) => {
      if (operation.channel === 'media') throw new Error('offline upload');
      return { status: 'applied', serverRevision: 4 };
    }));
    await queue.enqueue({ projectId: 'p1', channel: 'media', payload: { path: 'capture.png' } });
    await queue.enqueue({ projectId: 'p1', channel: 'metadata', payload: { title: 'saved text' } });

    await queue.flush();

    const operations = await store.list();
    expect(operations.find((item) => item.channel === 'metadata')?.state).toBe('applied');
    expect(operations.find((item) => item.channel === 'media')).toMatchObject({ state: 'pending', attempts: 1 });
  });

  it('preserves both sides of an optimistic-lock conflict', async () => {
    const store = new MemorySyncStore();
    const queue = new SyncQueue(store, new ControlledAdapter(async () => ({
      status: 'conflict',
      serverRevision: 9,
      remotePayload: { title: 'remote title' },
    })));
    await queue.enqueue({ projectId: 'p1', channel: 'metadata', baseServerRevision: 7, payload: { title: 'local title' } });

    await queue.flush();

    expect(await store.list()).toEqual([
      expect.objectContaining({
        state: 'conflict',
        baseServerRevision: 7,
        payload: { title: 'local title' },
        conflict: { serverRevision: 9, remotePayload: { title: 'remote title' } },
      }),
    ]);
  });

  it('keeps retryable failures queued with a stable mutation id', async () => {
    const store = new MemorySyncStore();
    const queue = new SyncQueue(store, new ControlledAdapter(async () => { throw new Error('temporary'); }));
    const operation = await queue.enqueue({ projectId: 'p1', channel: 'metadata', payload: { notes: 'one' } });

    await queue.flush();
    await queue.flush();

    const [failed] = await store.list();
    expect(failed.clientMutationId).toBe(operation.clientMutationId);
    expect(failed).toMatchObject({ state: 'pending', attempts: 2, lastError: 'temporary' });
  });

  it('serializes overlapping flush requests so a mutation is sent once', async () => {
    const store = new MemorySyncStore();
    let pushes = 0;
    const queue = new SyncQueue(store, new ControlledAdapter(async () => {
      pushes += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { status: 'applied', serverRevision: 1 };
    }));
    await queue.enqueue({ projectId: 'p1', channel: 'metadata', payload: { title: 'once' } });

    await Promise.all([queue.flush(), queue.flush()]);

    expect(pushes).toBe(1);
  });
});
