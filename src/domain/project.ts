import type {
  DomainContext,
  OriginalSource,
  ProjectAggregate,
  ProjectRecord,
  Revision,
  RevisionReason,
  RuntimeProfileId,
} from './types';

export interface CreateProjectInput {
  code: string;
  title?: string;
  notes?: string;
  tags?: string[];
  sourceUrl?: string;
  author?: string;
  profileId: RuntimeProfileId;
}

export const defaultDomainContext: DomainContext = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  hash: async (value) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  },
};

export async function createProject(
  input: CreateProjectInput,
  context: DomainContext = defaultDomainContext,
): Promise<ProjectAggregate> {
  const projectId = context.id();
  const sourceId = context.id();
  const revisionId = context.id();
  const now = context.now();

  const originalSource: OriginalSource = Object.freeze({
    id: sourceId,
    projectId,
    rawCode: input.code,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    author: input.author?.trim() || undefined,
    collectedAt: now,
    contentHash: await context.hash(input.code),
  });

  const initialRevision: Revision = {
    id: revisionId,
    projectId,
    code: input.code,
    profileId: input.profileId,
    profileVersion: '1',
    wrapperVersion: '1',
    reason: 'collected',
    result: 'draft',
    createdAt: now,
  };

  const project: ProjectRecord = {
    id: projectId,
    originalSourceId: sourceId,
    title: input.title?.trim() || automaticProjectTitle(input.profileId, now),
    notes: input.notes?.trim() || '',
    tags: uniqueTags(input.tags ?? []),
    favorite: false,
    profileId: input.profileId,
    draftCode: input.code,
    currentRevisionId: revisionId,
    status: 'draft',
    searchText: '',
    createdAt: now,
    updatedAt: now,
  };
  project.searchText = projectSearchText(project, originalSource);

  return { project, originalSource, initialRevision };
}

function automaticProjectTitle(profileId: RuntimeProfileId, timestamp: string): string {
  const profileName: Record<RuntimeProfileId, string> = {
    'glsl-webgl2': 'GLSL 노트',
    'p5-webgl': 'p5.js 노트',
    'three-webgl': 'three.js 노트',
  };
  const date = new Date(timestamp);
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  return `${profileName[profileId]} · ${twoDigits(date.getMonth() + 1)}.${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export function createRevision(
  project: ProjectRecord,
  reason: RevisionReason,
  context: Pick<DomainContext, 'id' | 'now'> = defaultDomainContext,
): Revision {
  return {
    id: context.id(),
    projectId: project.id,
    parentRevisionId: project.currentRevisionId,
    code: project.draftCode,
    profileId: project.profileId,
    profileVersion: '1',
    wrapperVersion: '1',
    reason,
    result: 'running',
    createdAt: context.now(),
  };
}

export function projectSearchText(project: ProjectRecord, source: OriginalSource): string {
  const hostname = safeHostname(source.sourceUrl);
  return [project.title, project.notes, project.tags.join(' '), project.profileId, project.draftCode, hostname]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function matchesProjectSearch(project: ProjectRecord, query: string): boolean {
  const tokens = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return tokens.every((token) => project.searchText.includes(token));
}

function safeHostname(value?: string): string {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))];
}
