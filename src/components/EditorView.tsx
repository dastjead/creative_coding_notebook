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

  if (!project || !original) return <div className="loading-state">작업본을 펼치는 중…</div>;
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
  };
  const restore = async () => {
    const restored = await repository.restoreLastSuccessful(project.id);
    if (restored) setProject(restored);
  };

  return (
    <section className="editor-view page-enter">
      <header className="editor-header">
        <button type="button" className="back-button" onClick={onBack}>← ARCHIVE</button>
        <div className="editor-title-block">
          <input aria-label="프로젝트 제목" value={project.title} onChange={(event) => update({ title: event.target.value })} />
          <p>{profile.label} / WRAPPER 01</p>
        </div>
        <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '저장됨' : saveState === 'saving' ? '저장 중' : '변경됨'}</span>
      </header>

      <div className="editor-tabs" role="tablist" aria-label="편집 화면">
        <button role="tab" aria-selected={activePane === 'code'} onClick={() => setActivePane('code')}>CODE</button>
        <button role="tab" aria-selected={activePane === 'preview'} onClick={() => setActivePane('preview')}>OUTPUT <span className={`run-dot ${runnerState}`} /></button>
      </div>

      <div className="workbench">
        <div className={`code-pane ${activePane === 'code' ? 'is-active' : ''}`}>
          <div className="pane-label"><span>WORKING REVISION</span><span>UTF–8</span></div>
          <CodeEditor value={project.draftCode} language={profile.language} onChange={(draftCode) => update({ draftCode })} />
        </div>
        <div className={`preview-pane ${activePane === 'preview' ? 'is-active' : ''}`}>
          <div className="pane-label"><span>LIVE OUTPUT</span><span>{runnerState.toUpperCase()}</span></div>
          <div className="preview-stage" ref={previewRoot} />
          <div className="preview-coordinates">390 × 520 / DPR ≤ 1.5</div>
        </div>
      </div>

      {error && <div className="error-strip" role="alert"><strong>{error.category.toUpperCase()}</strong><span>{error.line ? `L${error.line} · ` : ''}{error.message}</span><button type="button" onClick={restore}>마지막 성공본 복구</button></div>}

      <div className="run-toolbar" aria-label="실행 도구">
        <button type="button" className="run-button" onClick={run}><Icon name="play" /><span>실행</span></button>
        <button type="button" onClick={stop}><Icon name="stop" /><span>중지</span></button>
        <button type="button" onClick={hardReset}><Icon name="reset" /><span>초기화</span></button>
        <button type="button" onClick={() => session.current?.capture()} disabled={runnerState !== 'running'}><Icon name="camera" /><span>캡처</span></button>
      </div>

      <div className="editor-meta-grid">
        <label>메모<textarea value={project.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="이 실험에서 기억할 것…" /></label>
        <label>태그<input value={project.tags.join(', ')} onChange={(event) => update({ tags: event.target.value.split(',') })} placeholder="shader, light, field" /></label>
        <details className="original-source"><summary>변경되지 않은 원본 보기</summary><pre>{original.rawCode}</pre>{original.sourceUrl && <a href={original.sourceUrl} target="_blank" rel="noreferrer">원본 링크 열기 ↗</a>}</details>
        <div className="asset-panel">
          <label className="asset-import">로컬 에셋 추가<input type="file" multiple onChange={async (event) => {
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
  return <button type="button" className={selected ? 'selected' : ''} onClick={onSelect} aria-label={`${title} 대표 캡처로 지정`}><img src={url} alt={`${title} 캡처`} /></button>;
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
