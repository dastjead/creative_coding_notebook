import Dexie, { type EntityTable } from 'dexie';
import JSZip from 'jszip';
import {
  createProject,
  createRevision,
  defaultDomainContext,
  matchesProjectSearch,
  projectSearchText,
  type CreateProjectInput,
} from '../domain/project';
import type {
  AssetRecord,
  CaptureRecord,
  OriginalSource,
  ProjectAggregate,
  ProjectRecord,
  Revision,
  RunStatus,
} from '../domain/types';

interface ArchiveManifest {
  format: 'creative-coding-notebook';
  version: 1;
  exportedAt: string;
  project: ProjectRecord;
  originalSource: OriginalSource;
  revisions: Revision[];
  assets: Array<Omit<AssetRecord, 'blob'> & { path: string }>;
  captures: Array<Omit<CaptureRecord, 'blob'> & { path: string }>;
}

type StoredAssetRecord = Omit<AssetRecord, 'blob'> & { blob: ArrayBuffer };
type StoredCaptureRecord = Omit<CaptureRecord, 'blob'> & { blob: ArrayBuffer };

export type RepositoryMutation =
  | {
      channel: 'metadata';
      project: ProjectRecord;
      originalSource?: OriginalSource;
      revision?: Revision;
    }
  | {
      channel: 'media';
      kind: 'asset';
      record: AssetRecord;
    }
  | {
      channel: 'media';
      kind: 'capture';
      record: CaptureRecord;
    };

export interface RepositoryObserver {
  record(mutation: RepositoryMutation): Promise<void>;
}

class NotebookDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  originalSources!: EntityTable<OriginalSource, 'id'>;
  revisions!: EntityTable<Revision, 'id'>;
  assets!: EntityTable<StoredAssetRecord, 'id'>;
  captures!: EntityTable<StoredCaptureRecord, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt, deletedAt, favorite, profileId, *tags',
      originalSources: 'id, projectId, contentHash',
      revisions: 'id, projectId, parentRevisionId, createdAt, result',
      assets: 'id, projectId, checksum, createdAt',
      captures: 'id, projectId, revisionId, createdAt',
    });
  }
}

export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<ProjectAggregate>;
  getProject(id: string): Promise<ProjectRecord | undefined>;
  getOriginal(projectId: string): Promise<OriginalSource | undefined>;
  list(query?: string): Promise<ProjectRecord[]>;
  saveDraft(id: string, patch: Partial<Pick<ProjectRecord, 'title' | 'notes' | 'tags' | 'profileId' | 'draftCode' | 'favorite'>>): Promise<ProjectRecord>;
  startRun(projectId: string): Promise<Revision>;
  finishRun(revisionId: string, result: Extract<RunStatus, 'success' | 'error' | 'stopped'>): Promise<void>;
  restoreLastSuccessful(projectId: string): Promise<ProjectRecord | undefined>;
  softDelete(projectId: string): Promise<void>;
  restoreDeleted(projectId: string): Promise<void>;
}

export class DexieProjectRepository implements ProjectRepository {
  private readonly db: NotebookDatabase;

  constructor(name = 'creative-coding-notebook', private readonly observer?: RepositoryObserver) {
    this.db = new NotebookDatabase(name);
  }

  async create(input: CreateProjectInput): Promise<ProjectAggregate> {
    const aggregate = await createProject(input);
    await this.db.transaction('rw', this.db.projects, this.db.originalSources, this.db.revisions, async () => {
      await this.db.projects.add(aggregate.project);
      await this.db.originalSources.add(aggregate.originalSource);
      await this.db.revisions.add(aggregate.initialRevision);
    });
    await this.notify({
      channel: 'metadata',
      project: aggregate.project,
      originalSource: aggregate.originalSource,
      revision: aggregate.initialRevision,
    });
    return aggregate;
  }

  getProject(id: string) {
    return this.db.projects.get(id);
  }

  getOriginal(projectId: string) {
    return this.db.originalSources.where('projectId').equals(projectId).first();
  }

  async list(query = ''): Promise<ProjectRecord[]> {
    const projects = (await this.db.projects.toArray())
      .filter((project) => !project.deletedAt)
      .filter((project) => matchesProjectSearch(project, query));
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveDraft(
    id: string,
    patch: Partial<Pick<ProjectRecord, 'title' | 'notes' | 'tags' | 'profileId' | 'draftCode' | 'favorite'>>,
  ): Promise<ProjectRecord> {
    const project = await this.requireProject(id);
    const source = await this.requireOriginal(id);
    const next: ProjectRecord = {
      ...project,
      ...patch,
      tags: patch.tags ? [...new Set(patch.tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))] : project.tags,
      status: patch.draftCode !== undefined || patch.profileId !== undefined ? 'draft' : project.status,
      updatedAt: defaultDomainContext.now(),
    };
    next.searchText = projectSearchText(next, source);
    await this.db.projects.put(next);
    await this.notify({ channel: 'metadata', project: next });
    return next;
  }

  async startRun(projectId: string): Promise<Revision> {
    const project = await this.requireProject(projectId);
    const revision = createRevision(project, 'run');
    await this.db.transaction('rw', this.db.projects, this.db.revisions, async () => {
      await this.db.revisions.add(revision);
      await this.db.projects.update(projectId, {
        currentRevisionId: revision.id,
        status: 'running',
        updatedAt: defaultDomainContext.now(),
      });
    });
    await this.notify({
      channel: 'metadata',
      project: { ...project, currentRevisionId: revision.id, status: 'running', updatedAt: defaultDomainContext.now() },
      revision,
    });
    return revision;
  }

  async finishRun(
    revisionId: string,
    result: Extract<RunStatus, 'success' | 'error' | 'stopped'>,
  ): Promise<void> {
    const revision = await this.db.revisions.get(revisionId);
    if (!revision) throw new Error(`Revision not found: ${revisionId}`);
    await this.db.transaction('rw', this.db.projects, this.db.revisions, async () => {
      await this.db.revisions.update(revisionId, { result });
      const update: Partial<ProjectRecord> = { status: result, updatedAt: defaultDomainContext.now() };
      if (result === 'success') update.lastSuccessfulRevisionId = revisionId;
      await this.db.projects.update(revision.projectId, update);
    });
    const project = await this.requireProject(revision.projectId);
    await this.notify({ channel: 'metadata', project, revision: { ...revision, result } });
  }

  async restoreLastSuccessful(projectId: string): Promise<ProjectRecord | undefined> {
    const project = await this.requireProject(projectId);
    if (!project.lastSuccessfulRevisionId) return project;
    const revision = await this.db.revisions.get(project.lastSuccessfulRevisionId);
    if (!revision) return project;
    return this.saveDraft(projectId, { draftCode: revision.code, profileId: revision.profileId });
  }

  async softDelete(projectId: string): Promise<void> {
    await this.db.projects.update(projectId, {
      deletedAt: defaultDomainContext.now(),
      updatedAt: defaultDomainContext.now(),
    });
    await this.notify({ channel: 'metadata', project: await this.requireProject(projectId) });
  }

  async restoreDeleted(projectId: string): Promise<void> {
    await this.db.projects.update(projectId, {
      deletedAt: undefined,
      updatedAt: defaultDomainContext.now(),
    });
    await this.notify({ channel: 'metadata', project: await this.requireProject(projectId) });
  }

  async duplicate(projectId: string): Promise<ProjectAggregate> {
    const project = await this.requireProject(projectId);
    const source = await this.requireOriginal(projectId);
    return this.create({
      title: `${project.title} — 사본`,
      code: project.draftCode,
      notes: project.notes,
      tags: project.tags,
      sourceUrl: source.sourceUrl,
      author: source.author,
      profileId: project.profileId,
    });
  }

  async addCapture(input: Omit<CaptureRecord, 'id' | 'createdAt'>): Promise<CaptureRecord> {
    const capture: CaptureRecord = {
      ...input,
      id: defaultDomainContext.id(),
      createdAt: defaultDomainContext.now(),
    };
    const storedBlob = await readBlobArrayBuffer(capture.blob);
    await this.db.transaction('rw', this.db.captures, this.db.projects, async () => {
      await this.db.captures.add({ ...capture, blob: storedBlob });
      await this.db.projects.update(capture.projectId, {
        coverCaptureId: capture.id,
        updatedAt: defaultDomainContext.now(),
      });
    });
    await this.notify({ channel: 'media', kind: 'capture', record: capture });
    await this.notify({ channel: 'metadata', project: await this.requireProject(capture.projectId) });
    return capture;
  }

  getCapture(captureId: string): Promise<CaptureRecord | undefined> {
    return this.db.captures.get(captureId).then((capture) => capture ? restoreCapture(capture) : undefined);
  }

  async setCoverCapture(projectId: string, captureId: string): Promise<void> {
    const capture = await this.db.captures.get(captureId);
    if (!capture || capture.projectId !== projectId) throw new Error('Capture does not belong to project');
    await this.db.projects.update(projectId, { coverCaptureId: captureId, updatedAt: defaultDomainContext.now() });
    await this.notify({ channel: 'metadata', project: await this.requireProject(projectId) });
  }

  listCaptures(projectId: string): Promise<CaptureRecord[]> {
    return this.db.captures.where('projectId').equals(projectId).reverse().sortBy('createdAt')
      .then((captures) => captures.map(restoreCapture));
  }

  async addAsset(input: Omit<AssetRecord, 'id' | 'createdAt'>): Promise<AssetRecord> {
    const asset: AssetRecord = { ...input, id: defaultDomainContext.id(), createdAt: defaultDomainContext.now() };
    await this.db.assets.add({ ...asset, blob: await readBlobArrayBuffer(asset.blob) });
    await this.notify({ channel: 'media', kind: 'asset', record: asset });
    return asset;
  }

  listAssets(projectId: string): Promise<AssetRecord[]> {
    return this.db.assets.where('projectId').equals(projectId).sortBy('createdAt')
      .then((assets) => assets.map(restoreAsset));
  }

  listRevisions(projectId: string): Promise<Revision[]> {
    return this.db.revisions.where('projectId').equals(projectId).sortBy('createdAt');
  }

  async exportArchive(projectId: string): Promise<Blob> {
    const project = await this.requireProject(projectId);
    const originalSource = await this.requireOriginal(projectId);
    const revisions = await this.listRevisions(projectId);
    const assets = await this.db.assets.where('projectId').equals(projectId).toArray();
    const captures = await this.db.captures.where('projectId').equals(projectId).toArray();
    const zip = new JSZip();
    const assetManifest = assets.map(({ blob: _blob, ...asset }) => ({ ...asset, path: `assets/${asset.id}-${safeName(asset.name)}` }));
    const captureManifest = captures.map(({ blob: _blob, ...capture }) => ({ ...capture, path: `captures/${capture.id}.png` }));
    const manifest: ArchiveManifest = {
      format: 'creative-coding-notebook',
      version: 1,
      exportedAt: defaultDomainContext.now(),
      project,
      originalSource,
      revisions,
      assets: assetManifest,
      captures: captureManifest,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('source/original.txt', originalSource.rawCode);
    zip.file('source/current.txt', project.draftCode);
    for (const revision of revisions) zip.file(`revisions/${revision.id}.txt`, revision.code);
    assets.forEach((asset, index) => zip.file(assetManifest[index].path, asset.blob));
    captures.forEach((capture, index) => zip.file(captureManifest[index].path, capture.blob));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return new Blob([Uint8Array.from(bytes).buffer], { type: 'application/zip' });
  }

  async importArchive(blob: Blob): Promise<string> {
    const zip = await JSZip.loadAsync(await readBlobArrayBuffer(blob));
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('올바른 노트 백업이 아닙니다. manifest.json 파일이 없습니다.');
    const manifest = JSON.parse(await manifestFile.async('text')) as ArchiveManifest;
    if (manifest.format !== 'creative-coding-notebook' || manifest.version !== 1) {
      throw new Error('지원하지 않는 노트 백업 형식입니다.');
    }
    const projectId = defaultDomainContext.id();
    const sourceId = defaultDomainContext.id();
    const revisionIds = new Map(manifest.revisions.map((revision) => [revision.id, defaultDomainContext.id()]));
    const captureIds = new Map(manifest.captures.map((capture) => [capture.id, defaultDomainContext.id()]));
    const now = defaultDomainContext.now();
    const source: OriginalSource = {
      ...manifest.originalSource,
      id: sourceId,
      projectId,
      collectedAt: manifest.originalSource.collectedAt || now,
    };
    const revisions: Revision[] = manifest.revisions.map((revision) => ({
      ...revision,
      id: revisionIds.get(revision.id)!,
      projectId,
      parentRevisionId: revision.parentRevisionId ? revisionIds.get(revision.parentRevisionId) : undefined,
    }));
    const project: ProjectRecord = {
      ...manifest.project,
      id: projectId,
      originalSourceId: sourceId,
      currentRevisionId: revisionIds.get(manifest.project.currentRevisionId) ?? revisions.at(-1)?.id ?? defaultDomainContext.id(),
      lastSuccessfulRevisionId: manifest.project.lastSuccessfulRevisionId
        ? revisionIds.get(manifest.project.lastSuccessfulRevisionId)
        : undefined,
      coverCaptureId: manifest.project.coverCaptureId
        ? captureIds.get(manifest.project.coverCaptureId)
        : undefined,
      deletedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    project.searchText = projectSearchText(project, source);

    await this.db.transaction('rw', this.db.projects, this.db.originalSources, this.db.revisions, this.db.assets, this.db.captures, async () => {
      await this.db.projects.add(project);
      await this.db.originalSources.add(source);
      await this.db.revisions.bulkAdd(revisions);
      for (const archivedAsset of manifest.assets) {
        const file = zip.file(archivedAsset.path);
        if (!file) continue;
        const { path: _path, ...asset } = archivedAsset;
        await this.db.assets.add({ ...asset, id: defaultDomainContext.id(), projectId, blob: await file.async('arraybuffer') });
      }
      for (const archivedCapture of manifest.captures) {
        const file = zip.file(archivedCapture.path);
        if (!file) continue;
        const { path: _path, ...capture } = archivedCapture;
        await this.db.captures.add({
          ...capture,
          id: captureIds.get(capture.id) ?? defaultDomainContext.id(),
          projectId,
          revisionId: revisionIds.get(capture.revisionId) ?? project.currentRevisionId,
          blob: await file.async('arraybuffer'),
        });
      }
    });
    await this.notify({ channel: 'metadata', project, originalSource: source });
    for (const revision of revisions) {
      await this.notify({ channel: 'metadata', project, revision });
    }
    return projectId;
  }

  async destroy() {
    this.db.close();
    await Dexie.delete(this.db.name);
  }

  private async requireProject(id: string): Promise<ProjectRecord> {
    const project = await this.db.projects.get(id);
    if (!project) throw new Error(`노트를 찾을 수 없습니다: ${id}`);
    return project;
  }

  private async requireOriginal(projectId: string): Promise<OriginalSource> {
    const source = await this.getOriginal(projectId);
    if (!source) throw new Error(`원본 코드를 찾을 수 없습니다: ${projectId}`);
    return source;
  }

  private async notify(mutation: RepositoryMutation) {
    try {
      await this.observer?.record(mutation);
    } catch {
      // The local commit is authoritative. Sync/outbox failures must never undo it.
    }
  }
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'asset';
}

async function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('노트 백업을 읽을 수 없습니다.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

function restoreCapture(capture: StoredCaptureRecord): CaptureRecord {
  return { ...capture, blob: new Blob([capture.blob], { type: capture.mimeType }) };
}

function restoreAsset(asset: StoredAssetRecord): AssetRecord {
  return { ...asset, blob: new Blob([asset.blob], { type: asset.mimeType }) };
}
