// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DexieProjectRepository, type RepositoryMutation } from './repository';

describe('DexieProjectRepository', () => {
  let repository: DexieProjectRepository;

  beforeEach(() => {
    repository = new DexieProjectRepository(`test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await repository.destroy();
  });

  it('stores a project and searches across metadata and code', async () => {
    const created = await repository.create({
      title: 'Aurora study',
      code: 'const northernLights = true;',
      profileId: 'three-webgl',
      tags: ['sky'],
      sourceUrl: 'https://example.art/aurora',
    });

    await repository.saveDraft(created.project.id, {
      notes: 'green ribbons',
      draftCode: 'const northernLights = "green";',
    });

    expect((await repository.list('ribbons green example.art')).map((item) => item.id)).toEqual([
      created.project.id,
    ]);
    expect((await repository.getOriginal(created.project.id))?.rawCode).toBe(
      'const northernLights = true;',
    );
  });

  it('records successful revisions and restores the last-known-good code', async () => {
    const created = await repository.create({
      title: 'Pulse',
      code: 'function setup(){}',
      profileId: 'p5-webgl',
    });
    await repository.saveDraft(created.project.id, { draftCode: 'function setup(){createCanvas(20,20)}' });
    const revision = await repository.startRun(created.project.id);
    await repository.finishRun(revision.id, 'success');
    await repository.saveDraft(created.project.id, { draftCode: 'broken(' });

    const restored = await repository.restoreLastSuccessful(created.project.id);

    expect(restored?.draftCode).toBe('function setup(){createCanvas(20,20)}');
    expect(restored?.status).toBe('draft');
  });

  it('soft deletes projects without losing their records', async () => {
    const created = await repository.create({ code: 'void main(){}', profileId: 'glsl-webgl2' });
    await repository.softDelete(created.project.id);

    expect(await repository.list()).toEqual([]);
    expect((await repository.getProject(created.project.id))?.deletedAt).toBeTruthy();
  });

  it('round-trips a project through a readable zip archive', async () => {
    const created = await repository.create({
      title: 'Portable fragment',
      code: 'void main(){gl_FragColor=vec4(0.2);}',
      sourceUrl: 'https://example.com/original',
      profileId: 'glsl-webgl2',
    });
    const archive = await repository.exportArchive(created.project.id);
    const importedRepository = new DexieProjectRepository(`import-${crypto.randomUUID()}`);

    try {
      const importedId = await importedRepository.importArchive(archive);
      const imported = await importedRepository.getProject(importedId);
      const source = await importedRepository.getOriginal(importedId);

      expect(imported?.title).toBe('Portable fragment');
      expect(source?.rawCode).toBe('void main(){gl_FragColor=vec4(0.2);}');
      expect(importedId).not.toBe(created.project.id);
    } finally {
      await importedRepository.destroy();
    }
  });

  it('reports durable metadata and media mutations without exposing originals to later edits', async () => {
    const mutations: RepositoryMutation[] = [];
    const observedRepository = new DexieProjectRepository(`observed-${crypto.randomUUID()}`, {
      async record(mutation) { mutations.push(mutation); },
    });
    try {
      const created = await observedRepository.create({ title: 'Observed', code: 'original', profileId: 'p5-webgl' });
      await observedRepository.saveDraft(created.project.id, { draftCode: 'working copy' });
      await observedRepository.addCapture({
        projectId: created.project.id,
        revisionId: created.initialRevision.id,
        mimeType: 'image/png',
        width: 1,
        height: 1,
        pixelRatio: 1,
        blob: new Blob(['png'], { type: 'image/png' }),
      });

      expect(mutations.map((item) => item.channel)).toEqual(['metadata', 'metadata', 'media']);
      expect(mutations[0]).toMatchObject({ originalSource: { rawCode: 'original' } });
      expect(mutations[1]).not.toHaveProperty('originalSource');
    } finally {
      await observedRepository.destroy();
    }
  });
});
