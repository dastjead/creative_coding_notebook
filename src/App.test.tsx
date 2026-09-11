import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { DexieProjectRepository } from './storage/repository';

describe('Notebook app', () => {
  let repository: DexieProjectRepository;

  beforeEach(() => {
    repository = new DexieProjectRepository(`ui-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    cleanup();
    await repository.destroy();
  });

  it('collects code, suggests a profile, and opens the working copy', async () => {
    const user = userEvent.setup();
    render(<App repository={repository} />);
    await user.click((await screen.findAllByRole('button', { name: '새 실험' }))[0]);
    await user.type(screen.getByLabelText('제목'), 'Red current');
    await user.type(screen.getByLabelText('출처 URL'), 'https://example.com/red');
    fireEvent.change(screen.getByLabelText('수집한 코드'), {
      target: { value: 'void mainImage(out vec4 c, in vec2 p){c=vec4(1.,0.,0.,1.);}' },
    });

    expect(screen.getByRole('heading', { name: 'GLSL / Shadertoy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '작업본 만들기' }));

    expect(await screen.findByLabelText('프로젝트 제목')).toHaveValue('Red current');
    expect(screen.getByRole('button', { name: '실행' })).toBeInTheDocument();
    expect((await repository.list())[0]?.draftCode).toContain('mainImage');
  });

  it('filters the library and persists favorite state', async () => {
    const first = await repository.create({ title: 'Aurora field', code: 'function setup(){}', profileId: 'p5-webgl', tags: ['sky'] });
    await repository.create({ title: 'Red noise', code: 'void main(){}', profileId: 'glsl-webgl2' });
    const user = userEvent.setup();
    render(<App repository={repository} />);

    await user.type(await screen.findByLabelText('라이브러리 검색'), 'sky');
    expect(await screen.findByText('Aurora field')).toBeInTheDocument();
    expect(screen.queryByText('Red noise')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aurora field 즐겨찾기' }));

    await waitFor(async () => {
      expect((await repository.getProject(first.project.id))?.favorite).toBe(true);
    });
  });

  it('imports a notebook archive into the library', async () => {
    const original = await repository.create({
      title: 'Portable orbit',
      code: 'void main(){gl_FragColor=vec4(1.);}',
      profileId: 'glsl-webgl2',
    });
    const archive = await repository.exportArchive(original.project.id);
    await repository.softDelete(original.project.id);
    const user = userEvent.setup();
    render(<App repository={repository} />);

    const file = new File([archive], 'portable-orbit.zip', { type: 'application/zip' });
    await user.upload(await screen.findByLabelText('프로젝트 ZIP 가져오기'), file);

    expect(await screen.findByText('Portable orbit')).toBeInTheDocument();
    expect((await repository.list())).toHaveLength(1);
  });
});
