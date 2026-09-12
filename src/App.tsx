import { useCallback, useEffect, useState } from 'react';
import { CollectView } from './components/CollectView';
import { EditorView } from './components/EditorView';
import { Icon } from './components/Icon';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import type { CaptureRecord, ProjectRecord } from './domain/types';
import { notebookRepository } from './storage';
import type { DexieProjectRepository } from './storage/repository';

type View = 'library' | 'collect' | 'editor' | 'settings';

function readRoute(): { view: View; projectId?: string } {
  const match = window.location.hash.match(/^#\/note\/([^/]+)$/);
  if (match) return { view: 'editor', projectId: decodeURIComponent(match[1]) };
  if (window.location.hash === '#/collect') return { view: 'collect' };
  if (window.location.hash === '#/settings') return { view: 'settings' };
  return { view: 'library' };
}

function routeHash(view: View, projectId?: string) {
  if (view === 'editor' && projectId) return `#/note/${encodeURIComponent(projectId)}`;
  if (view === 'collect') return '#/collect';
  if (view === 'settings') return '#/settings';
  return '#/library';
}

interface AppProps {
  repository?: DexieProjectRepository;
}

export default function App({ repository = notebookRepository }: AppProps) {
  const initialRoute = readRoute();
  const [view, setView] = useState<View>(initialRoute.view);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [coverCaptures, setCoverCaptures] = useState<Record<string, CaptureRecord>>({});
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialRoute.projectId);
  const [deletedProject, setDeletedProject] = useState<ProjectRecord>();
  const [autoRunProjectId, setAutoRunProjectId] = useState<string>();

  const refresh = useCallback(async (search = query) => {
    const listed = await repository.list(search);
    setProjects(listed);
    const covers = await Promise.all(listed.map(async (project) => {
      if (!project.coverCaptureId) return undefined;
      const capture = await repository.getCapture(project.coverCaptureId);
      return capture ? [project.id, capture] as const : undefined;
    }));
    setCoverCaptures(Object.fromEntries(covers.filter((item): item is readonly [string, CaptureRecord] => Boolean(item))));
  }, [query, repository]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const syncRoute = () => {
      const route = readRoute();
      setView(route.view);
      setSelectedId(route.projectId);
    };
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [view]);

  const navigate = (nextView: View, projectId?: string) => {
    const hash = routeHash(nextView, projectId);
    if (window.location.hash === hash) {
      setView(nextView);
      setSelectedId(projectId);
      return;
    }
    window.location.hash = hash;
  };

  const search = (value: string) => {
    setQuery(value);
    void refresh(value);
  };
  const openProject = (projectId: string) => {
    navigate('editor', projectId);
  };
  const exportProject = async (project: ProjectRecord) => {
    const archive = await repository.exportArchive(project.id);
    const url = URL.createObjectURL(archive);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.title.replace(/[^a-z0-9가-힣_-]+/gi, '-') || 'experiment'}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importProject = async (file: File) => {
    const projectId = await repository.importArchive(file);
    await refresh('');
    setQuery('');
    setSelectedId(projectId);
    navigate('library');
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>본문으로 건너뛰기</a>
      <header className="brand-bar">
        <button type="button" className="brand" onClick={() => navigate('library')} aria-label="Fieldnote 보관함으로 이동">
          <span className="brand-glyph">F/<i>N</i></span>
          <span>FIELDNOTE<br /><small>CREATIVE CODE ARCHIVE</small></span>
        </button>
        <div className="brand-status"><span /> 기기 저장 · {new Date().getFullYear()}</div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {view === 'library' && <LibraryView
          projects={projects}
          coverCaptures={coverCaptures}
          query={query}
          onQuery={search}
          onOpen={openProject}
          onNew={() => navigate('collect')}
          onFavorite={async (project) => { await repository.saveDraft(project.id, { favorite: !project.favorite }); await refresh(); }}
          onDuplicate={async (project) => { await repository.duplicate(project.id); await refresh(); }}
          onDelete={async (project) => {
            await repository.softDelete(project.id);
            setDeletedProject(project);
            await refresh();
          }}
          onExport={(project) => { void exportProject(project); }}
          onImport={importProject}
        />}
        {view === 'collect' && <CollectView repository={repository} onCancel={() => navigate('library')} onCreated={(projectId) => {
          setAutoRunProjectId(projectId);
          openProject(projectId);
        }} />}
        {view === 'editor' && selectedId && <EditorView
          projectId={selectedId}
          repository={repository}
          autoRun={autoRunProjectId === selectedId}
          onAutoRunConsumed={() => setAutoRunProjectId(undefined)}
          onBack={() => { navigate('library'); void refresh(); }}
          onChanged={() => { void refresh(); }}
        />}
        {view === 'settings' && <SettingsView />}
      </main>

      {(view === 'library' || view === 'settings') && <nav className="bottom-nav" aria-label="주 탐색">
        <button type="button" aria-current={view === 'library' ? 'page' : undefined} className={view === 'library' ? 'active' : ''} onClick={() => navigate('library')}><Icon name="archive" /><span>보관함</span></button>
        <button type="button" onClick={() => navigate('collect')}><Icon name="plus" /><span>새 노트</span></button>
        <button type="button" aria-current={view === 'settings' ? 'page' : undefined} className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Icon name="settings" /><span>설정</span></button>
      </nav>}

      {deletedProject && (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>노트를 삭제했습니다.</span>
          <button type="button" aria-label="삭제 실행 취소" onClick={async () => {
            await repository.restoreDeleted(deletedProject.id);
            setDeletedProject(undefined);
            await refresh();
          }}>실행 취소</button>
        </div>
      )}
    </div>
  );
}
