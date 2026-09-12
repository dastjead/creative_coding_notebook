import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetRecord, CaptureRecord, OriginalSource, ProjectRecord, Revision } from '../domain/types';
import { getRuntimeProfile, type NormalizedRuntimeError } from '../runtime/profiles';
import type { RunnerEvent } from '../runtime/protocol';
import { RunnerSession } from '../runtime/session';
import type { DexieProjectRepository } from '../storage/repository';
import { CodeEditor } from './CodeEditor';
import { Icon } from './Icon';

interface EditorViewProps {
  projectId: string;
  repository: DexieProjectRepository;
  onBack(): void;
  onChanged(): void;
}

const runnerLabels = {
  idle: '대기',
  ready: '준비됨',
  running: '실행 중',
  error: '오류',
} as const;

const errorLabels: Record<NormalizedRuntimeError['category'], string> = {
  javascript: 'JavaScript 오류',
  shader: '셰이더 오류',
  unsupported: '지원되지 않음',
  asset: '파일 오류',
  security: '보안 제한',
};

export function EditorView({ projectId, repository, onBack, onChanged }: EditorViewProps) {
  const [project, setProject] = useState<ProjectRecord>();
  const [original, setOriginal] = useState<OriginalSource>();
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [activePane, setActivePane] = useState<'code' | 'preview'>('code');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [runnerState, setRunnerState] = useState<'idle' | 'ready' | 'running' | 'error'>('idle');
  const [error, setError] = useState<NormalizedRuntimeError>();
  const [activeRevision, setActiveRevision] = useState<Revision>();
  const [feedback, setFeedback] = useState('');
  const previewRoot = useRef<HTMLDivElement>(null);
  const session = useRef<RunnerSession | undefined>(undefined);
  const projectRef = useRef<ProjectRecord | undefined>(undefined);
  const revisionRef = useRef<Revision | undefined>(undefined);

  const load = useCallback(async () => {
    const [nextProject, nextOriginal, nextCaptures, nextAssets] = await Promise.all([
      repository.getProject(projectId),
      repository.getOriginal(projectId),
      repository.listCaptures(projectId),
      repository.listAssets(projectId),
    ]);
    setProject(nextProject);
    setOriginal(nextOriginal);
    setCaptures(nextCaptures);
    setAssets(nextAssets);
  }, [projectId, repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { revisionRef.current = activeRevision; }, [activeRevision]);

  const handleRunnerEvent = useCallback(async (event: RunnerEvent) => {
    if (event.type === 'READY') setRunnerState('ready');
    if (event.type === 'STARTED') {
      setRunnerState('running');
      if (revisionRef.current) await repository.finishRun(revisionRef.current.id, 'success');
    }
    if (event.type === 'ERROR') {
      setRunnerState('error');
      setError(event.error);
      if (revisionRef.current) await repository.finishRun(revisionRef.current.id, 'error');
    }
    if (event.type === 'STOPPED') setRunnerState('ready');
    if (event.type === 'CAPTURED' && revisionRef.current) {
      const blob = dataUrlToBlob(event.dataUrl);
      await repository.addCapture({
        projectId,
        revisionId: revisionRef.current.id,
        mimeType: 'image/png',
        width: event.width,
        height: event.height,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        blob,
      });
      setCaptures(await repository.listCaptures(projectId));
      setFeedback('캡처를 저장했습니다.');
    }
  }, [projectId, repository]);

  useEffect(() => {
    if (!previewRoot.current) return;
    const nextSession = new RunnerSession(previewRoot.current, undefined, (event) => { void handleRunnerEvent(event); });
    nextSession.mount();
    session.current = nextSession;
    return () => nextSession.dispose();
  }, [handleRunnerEvent, project?.id]);

  useEffect(() => {
    if (!project || saveState !== 'dirty') return;
    const timeout = window.setTimeout(async () => {
      setSaveState('saving');
      const saved = await repository.saveDraft(project.id, project);
      setProject(saved);
      setSaveState('saved');
      onChanged();
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [onChanged, project, repository, saveState]);

  if (!project || !original) return <div className="loading-state">노트 불러오는 중…</div>;
  const profile = getRuntimeProfile(project.profileId);
  const update = (patch: Partial<ProjectRecord>) => {
    setProject((current) => current ? { ...current, ...patch } : current);
    setSaveState('dirty');
  };
  const flush = async () => {
    const current = projectRef.current!;
    setSaveState('saving');
    const saved = await repository.saveDraft(current.id, current);
    setProject(saved);
    projectRef.current = saved;
    setSaveState('saved');
    return saved;
  };
  const run = async () => {
    setError(undefined);
    const saved = await flush();
    const revision = await repository.startRun(project.id);
    setActiveRevision(revision);
    revisionRef.current = revision;
    setRunnerState('running');
    setActivePane('preview');
    const runnerAssets = await Promise.all(assets.map(async (asset) => ({
      name: asset.name,
      mimeType: asset.mimeType,
      bytes: await asset.blob.arrayBuffer(),
    })));
    session.current?.run(saved.profileId, saved.draftCode, { width: 390, height: 520, pixelRatio: Math.min(window.devicePixelRatio, 1.5) }, runnerAssets);
  };
  const stop = async () => {
    session.current?.stop();
    if (revisionRef.current) await repository.finishRun(revisionRef.current.id, 'stopped');
    setRunnerState('idle');
  };
  const hardReset = () => {
    session.current?.hardReset();
    setRunnerState('idle');
    setFeedback('실행 환경을 재시작했습니다.');
  };
  const restore = async () => {
    const restored = await repository.restoreLastSuccessful(project.id);
    if (restored) {
      setProject(restored);
      setSaveState('saved');
      setFeedback('마지막 정상 실행본으로 복원했습니다.');
    }
  };
  const handleTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextPane = event.key === 'ArrowLeft' || event.key === 'Home' ? 'code' : 'preview';
    setActivePane(nextPane);
    window.requestAnimationFrame(() => document.getElementById(`${nextPane}-tab`)?.focus());
  };

  return (
    <section className="editor-view page-enter">
      <header className="editor-header">
        <button type="button" className="back-button" aria-label="보관함" onClick={onBack}>← 보관함</button>
        <div className="editor-title-block">
          <input name="note-title" autoComplete="off" aria-label="노트 제목" value={project.title} onChange={(event) => update({ title: event.target.value })} />
          <p>{profile.label} · 실행 래퍼 01</p>
        </div>
        <span className={`save-state ${saveState}`} aria-live="polite">{saveState === 'saved' ? '저장 완료' : saveState === 'saving' ? '저장 중' : '저장 대기'}</span>
      </header>

      <div className="editor-tabs" role="tablist" aria-label="편집 화면" onKeyDown={handleTabKey}>
        <button id="code-tab" role="tab" aria-controls="code-panel" aria-selected={activePane === 'code'} tabIndex={activePane === 'code' ? 0 : -1} onClick={() => setActivePane('code')}>코드</button>
        <button id="preview-tab" role="tab" aria-controls="preview-panel" aria-selected={activePane === 'preview'} tabIndex={activePane === 'preview' ? 0 : -1} onClick={() => setActivePane('preview')}>결과 <span className={`run-dot ${runnerState}`} /></button>
      </div>

      <div className="workbench">
        <div id="code-panel" role="tabpanel" aria-labelledby="code-tab" className={`code-pane ${activePane === 'code' ? 'is-active' : ''}`}>
          <div className="pane-label"><span>작업본</span><span>UTF–8</span></div>
          <CodeEditor value={project.draftCode} language={profile.language} onChange={(draftCode) => update({ draftCode })} />
        </div>
        <div id="preview-panel" role="tabpanel" aria-labelledby="preview-tab" className={`preview-pane ${activePane === 'preview' ? 'is-active' : ''}`}>
          <div className="pane-label"><span>실행 결과</span><span aria-live="polite">{runnerLabels[runnerState]}</span></div>
          <div className="preview-stage" ref={previewRoot} />
          <div className="preview-coordinates">390 × 520 · 화면 밀도 ≤ 1.5</div>
        </div>
      </div>

      {error && <div className="error-strip" role="alert"><strong>{errorLabels[error.category]}</strong><span>{error.line ? `${error.line}번째 줄 · ` : ''}{error.message}</span><button type="button" onClick={restore}>마지막 정상 실행본으로 복원</button></div>}

      <div className="run-toolbar" aria-label="실행 도구">
        <button type="button" className="run-button" onClick={run}><Icon name="play" /><span>실행</span></button>
        <button type="button" onClick={stop}><Icon name="stop" /><span>중지</span></button>
        <button type="button" aria-label="실행 환경 재시작" onClick={hardReset}><Icon name="reset" /><span>재시작</span></button>
        <button type="button" onClick={() => { setFeedback('캡처 중…'); session.current?.capture(); }} disabled={runnerState !== 'running'}><Icon name="camera" /><span>캡처</span></button>
      </div>

      <p className={`editor-feedback ${feedback ? 'visible' : ''}`} role="status" aria-live="polite">{feedback}</p>

      <details className="editor-inspector">
        <summary>노트 정보와 파일</summary>
        <div className="editor-meta-grid">
        <label>메모<textarea name="notes" value={project.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="이 노트에서 기억할 것…" /></label>
        <label>태그<input name="tags" autoComplete="off" value={project.tags.join(', ')} onChange={(event) => update({ tags: event.target.value.split(',') })} placeholder="shader, light, field" /></label>
        <details className="original-source"><summary>원본 코드 보기 · 읽기 전용</summary><pre>{original.rawCode}</pre>{original.sourceUrl && <a href={original.sourceUrl} target="_blank" rel="noreferrer">출처 열기 ↗</a>}</details>
        <div className="asset-panel">
          <label className="asset-import">파일 추가<input aria-label="파일 추가" type="file" multiple onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            for (const file of files) {
              const bytes = await file.arrayBuffer();
              await repository.addAsset({
                projectId: project.id,
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                byteLength: file.size,
                checksum: await sha256(bytes),
                blob: file,
              });
            }
            setAssets(await repository.listAssets(project.id));
            event.target.value = '';
          }} /></label>
          <p>코드에서 <code>ASSETS['파일명']</code>으로 사용합니다.</p>
          {assets.length > 0 && <ul>{assets.map((asset) => <li key={asset.id}>{asset.name}<span>{formatBytes(asset.byteLength)}</span></li>)}</ul>}
        </div>
        {captures.length > 0 && <div className="capture-rail" aria-label="캡처">{captures.map((capture) => (
          <CaptureChoice
            key={capture.id}
            capture={capture}
            title={project.title}
            selected={project.coverCaptureId === capture.id}
            onSelect={async () => {
              await repository.setCoverCapture(project.id, capture.id);
              setProject(await repository.getProject(project.id));
            }}
          />
        ))}</div>}
        </div>
      </details>
    </section>
  );
}

function CaptureChoice({ capture, title, selected, onSelect }: { capture: CaptureRecord; title: string; selected: boolean; onSelect(): void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(capture.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [capture.blob]);
  return <button type="button" className={selected ? 'selected' : ''} onClick={onSelect} aria-pressed={selected} aria-label={`${title} 대표 캡처로 지정`}><img src={url} alt={`${title} 캡처`} width={capture.width} height={capture.height} />{selected && <span>대표</span>}</button>;
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
