export type RuntimeProfileId = 'glsl-webgl2' | 'p5-webgl' | 'three-webgl';
export type RunStatus = 'draft' | 'running' | 'success' | 'error' | 'stopped';
export type RevisionReason = 'collected' | 'run' | 'capture' | 'manual' | 'conflict';

export interface ProjectRecord {
  id: string;
  originalSourceId: string;
  title: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  profileId: RuntimeProfileId;
  draftCode: string;
  currentRevisionId: string;
  lastSuccessfulRevisionId?: string;
  coverCaptureId?: string;
  status: RunStatus;
  searchText: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OriginalSource {
  id: string;
  projectId: string;
  readonly rawCode: string;
  readonly sourceUrl?: string;
  readonly author?: string;
  readonly collectedAt: string;
  readonly contentHash: string;
}

export interface Revision {
  id: string;
  projectId: string;
  parentRevisionId?: string;
  code: string;
  profileId: RuntimeProfileId;
  profileVersion: string;
  wrapperVersion: string;
  reason: RevisionReason;
  result: RunStatus;
  createdAt: string;
}

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  byteLength: number;
  checksum: string;
  blob: Blob;
  createdAt: string;
}

export interface CaptureRecord {
  id: string;
  projectId: string;
  revisionId: string;
  mimeType: 'image/png';
  width: number;
  height: number;
  pixelRatio: number;
  blob: Blob;
  createdAt: string;
}

export interface ProjectAggregate {
  project: ProjectRecord;
  originalSource: OriginalSource;
  initialRevision: Revision;
}

export interface DomainContext {
  id(): string;
  now(): string;
  hash(value: string): Promise<string>;
}

export interface ProfileMatch {
  profileId: RuntimeProfileId;
  confidence: number;
  reasons: string[];
}
