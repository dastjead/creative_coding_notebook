import { useEffect, useState } from 'react';
import type { CaptureRecord, ProjectRecord } from '../domain/types';
import { runtimeProfiles } from '../runtime/profiles';
import { Icon } from './Icon';

interface LibraryViewProps {
  projects: ProjectRecord[];
  coverCaptures: Record<string, CaptureRecord>;
  query: string;
  onQuery(value: string): void;
  onOpen(projectId: string): void;
  onNew(): void;
  onFavorite(project: ProjectRecord): void;
  onDuplicate(project: ProjectRecord): void;
  onDelete(project: ProjectRecord): void;
  onExport(project: ProjectRecord): void;
  onImport(file: File): Promise<void>;
}

export function LibraryView(props: LibraryViewProps) {
  return (
    <section className="library-view page-enter" aria-labelledby="library-heading">
      <header className={`hero-header ${props.projects.length ? 'has-notes' : ''}`}>
        <div>
          <p className="eyebrow">나만의 코드 보관함 · {String(props.projects.length).padStart(3, '0')}</p>
          <h1 id="library-heading"><em>코드</em>가 이미지로 기억되는 곳.</h1>
        </div>
        {props.projects.length > 0 && <button type="button" className="new-experiment" onClick={props.onNew}><Icon name="plus" size={24} /><span>새 노트</span></button>}
      </header>

      <div className="library-tools">
        <label className="search-field"><Icon name="search" /><span className="sr-only">보관함 검색</span><input name="archive-search" type="search" autoComplete="off" aria-label="보관함 검색" value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="노트 검색" /></label>
        <label className="archive-import">
          <Icon name="upload" size={17} />
          <span>백업 가져오기</span>
          <input
            className="sr-only"
            type="file"
            accept=".zip,application/zip"
            aria-label="노트 백업 가져오기"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void props.onImport(file).finally(() => { event.target.value = ''; });
            }}
          />
        </label>
      </div>

      {props.projects.length === 0 ? (
        <div className="empty-state">
          <span className="empty-orbit" aria-hidden="true" />
          <p className="eyebrow">{props.query ? '검색 결과 없음' : '아직 저장된 노트가 없습니다'}</p>
          <h2>{props.query ? '다른 검색어로 찾아보세요.' : '첫 번째 빛을 수집해 보세요.'}</h2>
          {!props.query && <button type="button" className="primary-button" onClick={props.onNew}>새 노트 <Icon name="plus" /></button>}
        </div>
      ) : (
        <div className="contact-sheet">
          {props.projects.map((project, index) => {
            const profile = runtimeProfiles.find((item) => item.id === project.profileId)!;
            return (
              <article className="project-card" key={project.id} style={{ '--delay': `${Math.min(index, 8) * 45}ms` } as React.CSSProperties}>
                <button type="button" className="card-open" onClick={() => props.onOpen(project.id)}>
                  <ProjectVisual capture={props.coverCaptures[project.id]} index={index} />
                  <div className="card-copy">
                    <p>{profile.label} · {new Date(project.updatedAt).toLocaleDateString('ko-KR')}</p>
                    <h2>{project.title}</h2>
                    <div className="tag-line">{project.tags.length ? project.tags.map((tag) => <span key={tag}>#{tag}</span>) : <span>태그 없음</span>}</div>
                  </div>
                </button>
                <div className="card-actions">
                  <button type="button" aria-label={`${project.title} 즐겨찾기 ${project.favorite ? '해제' : '추가'}`} className={project.favorite ? 'is-favorite' : ''} onClick={() => props.onFavorite(project)}><Icon name="star" size={17} /></button>
                  <button type="button" aria-label={`${project.title} 사본 만들기`} onClick={() => props.onDuplicate(project)}><Icon name="copy" size={17} /></button>
                  <button type="button" aria-label={`${project.title} 백업 내보내기`} onClick={() => props.onExport(project)}><Icon name="download" size={17} /></button>
                  <button type="button" aria-label={`${project.title} 삭제`} onClick={() => props.onDelete(project)}><Icon name="trash" size={17} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProjectVisual({ capture, index }: { capture?: CaptureRecord; index: number }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!capture) { setUrl(undefined); return; }
    const next = URL.createObjectURL(capture.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [capture]);
  return (
    <div className={`card-visual visual-${index % 4}`}>
      <span>{String(index + 1).padStart(2, '0')}</span>
      {url ? <img src={url} alt="대표 캡처" width={capture?.width} height={capture?.height} /> : <i />}
    </div>
  );
}
