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
    window.history.replaceState(null, '', '/');
    await repository.destroy();
  });

  it('collects original code into a new note with Korean task labels', async () => {
    const user = userEvent.setup();
    render(<App repository={repository} />);
    await user.click((await screen.findAllByRole('button', { name: '새 노트' }))[0]);
    expect(screen.queryByRole('navigation', { name: '주 탐색' })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/collect');
    const codeInput = screen.getByLabelText('원본 코드');
    expect(codeInput).toHaveValue('');
    expect(codeInput).not.toHaveAttribute('placeholder');
    await user.type(screen.getByLabelText('제목 (선택)'), 'Red current');
    await user.type(screen.getByLabelText('출처 URL'), 'https://example.com/red');
    fireEvent.change(screen.getByLabelText('원본 코드'), {
      target: { value: 'void mainImage(out vec4 c, in vec2 p){c=vec4(1.,0.,0.,1.);}' },
    });

    expect(screen.getByRole('heading', { name: 'GLSL / Shadertoy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '노트 만들기' }));

    expect(await screen.findByLabelText('노트 제목')).toHaveValue('Red current');
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-controls', 'code-panel');
    expect(screen.getByRole('tab', { name: /결과/ })).toHaveAttribute('aria-controls', 'preview-panel');
    fireEvent.keyDown(screen.getByRole('tab', { name: '코드' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /결과/ })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toMatch(/^#\/note\//);
    expect(screen.getByRole('button', { name: '실행' })).toBeInTheDocument();
    const created = (await repository.list())[0]!;
    expect(created.draftCode).toContain('mainImage');
    await waitFor(async () => {
      expect(await repository.listRevisions(created.id)).toHaveLength(2);
    });
  });

  it('filters the library and persists favorite state', async () => {
    const first = await repository.create({ title: 'Aurora field', code: 'function setup(){}', profileId: 'p5-webgl', tags: ['sky'] });
    await repository.create({ title: 'Red noise', code: 'void main(){}', profileId: 'glsl-webgl2' });
    const user = userEvent.setup();
    render(<App repository={repository} />);

    await user.type(await screen.findByLabelText('보관함 검색'), 'sky');
    expect(await screen.findByText('Aurora field')).toBeInTheDocument();
    expect(screen.queryByText('Red noise')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aurora field 즐겨찾기 추가' }));

    await waitFor(async () => {
      expect((await repository.getProject(first.project.id))?.favorite).toBe(true);
    });
  });

  it('shows a neutral pending thumbnail instead of invented artwork before a successful run', async () => {
    await repository.create({ title: 'Waiting field', code: 'void main(){}', profileId: 'glsl-webgl2' });
    render(<App repository={repository} />);

    expect(await screen.findByText('실행 화면 없음')).toBeInTheDocument();
    expect(screen.queryByAltText('대표 캡처')).not.toBeInTheDocument();
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
    await user.upload(await screen.findByLabelText('노트 백업 가져오기'), file);

    expect(await screen.findByText('Portable orbit')).toBeInTheDocument();
    expect((await repository.list())).toHaveLength(1);
  });

  it('offers an undo action after deleting a note', async () => {
    const created = await repository.create({ title: 'Temporary light', code: 'void main(){}', profileId: 'glsl-webgl2' });
    const user = userEvent.setup();
    render(<App repository={repository} />);

    await user.click(await screen.findByRole('button', { name: 'Temporary light 삭제' }));
    expect(await screen.findByRole('status')).toHaveTextContent('노트를 삭제했습니다.');
    expect(screen.queryByText('Temporary light')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제 실행 취소' }));
    expect(await screen.findByText('Temporary light')).toBeInTheDocument();
    expect((await repository.getProject(created.project.id))?.deletedAt).toBeUndefined();
  });
});
