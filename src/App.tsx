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

interface AppProps {
  repository?: DexieProjectRepository;
}

export default function App({ repository = notebookRepository }: AppProps) {
  const [view, setView] = useState<View>('library');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [coverCaptures, setCoverCaptures] = useState<Record<string, CaptureRecord>>({});
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();

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

  const search = (value: string) => {
    setQuery(value);
    void refresh(value);
  };
  const openProject = (projectId: string) => {
    setSelectedId(projectId);
    setView('editor');
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
  };

  return (
    <div className="app-shell">
      <header className="brand-bar">
        <button type="button" className="brand" onClick={() => setView('library')} aria-label="Fieldnote 홈">
          <span className="brand-glyph">F/<i>N</i></span>
          <span>FIELDNOTE<br /><small>CREATIVE CODE ARCHIVE</small></span>
        </button>
        <div className="brand-status"><span /> LOCAL · {new Date().getFullYear()}</div>
      </header>

      <main>
        {view === 'library' && <LibraryView
          projects={projects}
          coverCaptures={coverCaptures}
          query={query}
          onQuery={search}
          onOpen={openProject}
          onNew={() => setView('collect')}
          onFavorite={async (project) => { await repository.saveDraft(project.id, { favorite: !project.favorite }); await refresh(); }}
          onDuplicate={async (project) => { await repository.duplicate(project.id); await refresh(); }}
          onDelete={async (project) => { await repository.softDelete(project.id); await refresh(); }}
          onExport={(project) => { void exportProject(project); }}
          onImport={importProject}
        />}
        {view === 'collect' && <CollectView repository={repository} onCancel={() => setView('library')} onCreated={openProject} />}
        {view === 'editor' && selectedId && <EditorView projectId={selectedId} repository={repository} onBack={() => { setView('library'); void refresh(); }} onChanged={() => { void refresh(); }} />}
        {view === 'settings' && <SettingsView />}
      </main>

      {view !== 'editor' && <nav className="bottom-nav" aria-label="주 탐색">
        <button type="button" className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Icon name="archive" /><span>Archive</span></button>
        <button type="button" className={view === 'collect' ? 'active' : ''} onClick={() => setView('collect')}><Icon name="plus" /><span>Collect</span></button>
        <button type="button" className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><Icon name="settings" /><span>System</span></button>
      </nav>}
    </div>
  );
}
