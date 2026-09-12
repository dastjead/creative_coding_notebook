import { describe, expect, it } from 'vitest';
import { createProject, createRevision, projectSearchText } from './project';

const context = {
  now: () => '2026-09-12T00:00:00.000Z',
  id: (() => {
    let next = 0;
    return () => `id-${++next}`;
  })(),
  hash: async (value: string) => `hash:${value}`,
};

describe('project domain', () => {
  it('preserves the collected source when the working draft changes', async () => {
    const aggregate = await createProject(
      {
        code: 'void main(){gl_FragColor=vec4(1.);}',
        title: 'White field',
        sourceUrl: 'https://example.com/sketch',
        profileId: 'glsl-webgl2',
      },
      context,
    );

    aggregate.project.draftCode = 'void main(){gl_FragColor=vec4(0.);}'

    expect(aggregate.originalSource.rawCode).toBe('void main(){gl_FragColor=vec4(1.);}');
    expect(aggregate.project.draftCode).toContain('vec4(0.)');
  });

  it('uses a Korean title when a note is collected without one', async () => {
    const aggregate = await createProject(
      { code: 'void main(){}', profileId: 'glsl-webgl2' },
      context,
    );

    expect(aggregate.project.title).toBe('제목 없는 노트');
  });

  it('creates a revision linked to the current revision', async () => {
    const aggregate = await createProject(
      { code: 'function setup(){}', title: 'Seed', profileId: 'p5-webgl' },
      context,
    );
    const revision = createRevision(aggregate.project, 'run', context);

    expect(revision.parentRevisionId).toBe(aggregate.initialRevision.id);
    expect(revision.code).toBe(aggregate.project.draftCode);
    expect(revision.reason).toBe('run');
  });

  it('builds searchable text from code, metadata, profile, and origin hostname', async () => {
    const aggregate = await createProject(
      {
        code: 'const aurora = true;',
        title: 'Northern lights',
        notes: 'soft gradients',
        tags: ['sky'],
        sourceUrl: 'https://shader.example/art/1',
        profileId: 'three-webgl',
      },
      context,
    );

    expect(projectSearchText(aggregate.project, aggregate.originalSource)).toBe(
      'northern lights soft gradients sky three-webgl const aurora = true; shader.example',
    );
  });
});
