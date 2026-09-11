import type { RepositoryMutation, RepositoryObserver } from '../storage/repository';
import type { SyncAdapter } from './types';
import { SyncQueue } from './queue';

export class SyncRepositoryObserver implements RepositoryObserver {
  constructor(
    private readonly queue: SyncQueue,
    private readonly adapter: SyncAdapter,
  ) {}

  async record(mutation: RepositoryMutation): Promise<void> {
    if (!this.adapter.enabled) return;
    if (mutation.channel === 'metadata') {
      await this.queue.enqueue({
        channel: 'metadata',
        projectId: mutation.project.id,
        payload: mutation,
      });
    } else {
      const record = mutation.record;
      const extension = mutation.kind === 'capture' ? 'png' : safeExtension(mutation.record.name);
      await this.queue.enqueue({
        channel: 'media',
        projectId: record.projectId,
        payload: {
          path: `${record.projectId}/${mutation.kind}/${record.id}.${extension}`,
          blob: record.blob,
          contentType: record.mimeType,
          kind: mutation.kind,
          record: { ...record, blob: undefined },
        },
      });
    }
    void this.queue.flush();
  }
}

function safeExtension(name: string) {
  const extension = name.split('.').at(-1)?.toLowerCase();
  return extension?.match(/^[a-z0-9]{1,8}$/) ? extension : 'bin';
}
