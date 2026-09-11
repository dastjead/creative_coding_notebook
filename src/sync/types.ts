export type SyncChannel = 'metadata' | 'media';
export type SyncOperationState = 'pending' | 'applied' | 'conflict';

export interface SyncConflict {
  serverRevision: number;
  remotePayload: unknown;
}

export interface SyncOperation {
  id: string;
  projectId: string;
  channel: SyncChannel;
  clientMutationId: string;
  baseServerRevision?: number;
  payload: unknown;
  state: SyncOperationState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  serverRevision?: number;
  conflict?: SyncConflict;
}

export type SyncResult =
  | { status: 'disabled' }
  | { status: 'applied'; serverRevision?: number }
  | { status: 'conflict'; serverRevision: number; remotePayload: unknown };

export interface SyncAdapter {
  readonly enabled: boolean;
  signInMagicLink(email: string): Promise<void>;
  push(operation: SyncOperation): Promise<SyncResult>;
}

export interface SyncOperationStore {
  put(operation: SyncOperation): Promise<void>;
  list(): Promise<SyncOperation[]>;
}

export interface EnqueueSyncOperation {
  projectId: string;
  channel: SyncChannel;
  baseServerRevision?: number;
  payload: unknown;
}
