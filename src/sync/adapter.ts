import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SyncAdapter, SyncOperation, SyncResult } from './types';

export interface SyncEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export class DisabledSyncAdapter implements SyncAdapter {
  readonly enabled = false;

  async signInMagicLink() {
    throw new Error('Supabase sync is not configured');
  }

  async push(): Promise<SyncResult> {
    return { status: 'disabled' };
  }
}

export class SupabaseSyncAdapter implements SyncAdapter {
  readonly enabled = true;

  constructor(private readonly client: SupabaseClient) {}

  async signInMagicLink(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async push(operation: SyncOperation): Promise<SyncResult> {
    if (operation.channel === 'media') return this.uploadMedia(operation);
    const { data, error } = await this.client.rpc('apply_project_mutation', {
      p_project_id: operation.projectId,
      p_client_mutation_id: operation.clientMutationId,
      p_base_server_revision: operation.baseServerRevision ?? null,
      p_payload: operation.payload,
    });
    if (error) throw error;
    return parseMutationResult(data);
  }

  private async uploadMedia(operation: SyncOperation): Promise<SyncResult> {
    const payload = operation.payload as {
      bucket?: string;
      path?: string;
      blob?: Blob;
      contentType?: string;
      kind?: 'asset' | 'capture';
      record?: Record<string, unknown>;
    };
    if (!payload.path || !payload.blob) throw new Error('Media operation requires path and blob');
    const { data: authData, error: authError } = await this.client.auth.getUser();
    if (authError || !authData.user) throw authError ?? new Error('Authentication required');
    const objectPath = `${authData.user.id}/${payload.path.replace(/^\/+/, '')}`;
    const { error } = await this.client.storage
      .from(payload.bucket ?? 'notebook-media')
      .upload(objectPath, payload.blob, { contentType: payload.contentType, upsert: true });
    if (error) throw error;
    if (payload.kind && payload.record) {
      const record = payload.record;
      const { error: metadataError } = await this.client.from('notebook_media').upsert({
        id: record.id,
        project_id: record.projectId,
        revision_id: record.revisionId ?? null,
        kind: payload.kind,
        object_path: objectPath,
        mime_type: record.mimeType,
        byte_length: record.byteLength ?? payload.blob.size,
        checksum: record.checksum ?? null,
        metadata: payload.kind === 'capture'
          ? { width: record.width, height: record.height, pixelRatio: record.pixelRatio }
          : { name: record.name },
        created_at: record.createdAt,
      });
      if (metadataError) throw metadataError;
    }
    return { status: 'applied' };
  }
}

export function createSyncAdapter(environment?: SyncEnvironment): SyncAdapter {
  const resolved = environment ?? (import.meta.env as unknown as SyncEnvironment);
  const url = resolved.VITE_SUPABASE_URL?.trim();
  const publishableKey = resolved.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return new DisabledSyncAdapter();
  return new SupabaseSyncAdapter(createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }));
}

function parseMutationResult(data: unknown): SyncResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Invalid mutation response');
  const result = row as Record<string, unknown>;
  const status = result.status;
  const serverRevision = Number(result.server_revision ?? result.serverRevision);
  if (status === 'conflict') {
    return {
      status,
      serverRevision,
      remotePayload: result.remote_payload ?? result.remotePayload,
    };
  }
  if (status === 'applied') return { status, serverRevision };
  throw new Error('Unknown mutation response');
}
