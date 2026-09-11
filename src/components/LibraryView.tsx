import type { ProjectRecord } from '../domain/types';
import { runtimeProfiles } from '../runtime/profiles';
import { Icon } from './Icon';

interface LibraryViewProps {
  projects: ProjectRecord[];
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
      <header className="hero-header">
        <div>
          <p className="eyebrow">PRIVATE FIELD ARCHIVE · {String(props.projects.length).padStart(3, '0')}</p>
          <h1 id="library-heading"><em>코드</em>가 이미지로<br />기억되는 곳.</h1>
        </div>
        <button type="button" className="new-experiment" onClick={props.onNew}><Icon name="plus" size={24} /><span>새 실험</span></button>
      </header>

      <div className="library-tools">
        <label className="search-field"><Icon name="search" /><span className="sr-only">라이브러리 검색</span><input aria-label="라이브러리 검색" value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="제목, 코드, 태그, 출처…" /></label>
        <label className="archive-import">
          <Icon name="upload" size={17} />
          <span>ZIP 가져오기</span>
          <input
            className="sr-only"
            type="file"
            accept=".zip,application/zip"
            aria-label="프로젝트 ZIP 가져오기"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void props.onImport(file).finally(() => { event.target.value = ''; });
            }}
          />
        </label>
      </div>

      {props.projects.length === 0 ? (
        <div className="empty-state">
          <span className="empty-orbit" />
          <p className="eyebrow">NOTHING PINNED — YET</p>
          <h2>{props.query ? '검색된 실험이 없습니다.' : '첫 번째 빛을 수집해 보세요.'}</h2>
          {!props.query && <button type="button" className="primary-button" onClick={props.onNew}>새 실험 <Icon name="plus" /></button>}
        </div>
      ) : (
        <div className="contact-sheet">
          {props.projects.map((project, index) => {
            const profile = runtimeProfiles.find((item) => item.id === project.profileId)!;
            return (
              <article className="project-card" key={project.id} style={{ '--delay': `${index * 45}ms` } as React.CSSProperties}>
                <button type="button" className="card-open" onClick={() => props.onOpen(project.id)}>
                  <div className={`card-visual visual-${index % 4}`}><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
                  <div className="card-copy">
                    <p>{profile.label} · {new Date(project.updatedAt).toLocaleDateString('ko-KR')}</p>
                    <h2>{project.title}</h2>
                    <div className="tag-line">{project.tags.length ? project.tags.map((tag) => <span key={tag}>#{tag}</span>) : <span>#untagged</span>}</div>
                  </div>
                </button>
                <div className="card-actions">
                  <button type="button" aria-label={`${project.title} 즐겨찾기`} className={project.favorite ? 'is-favorite' : ''} onClick={() => props.onFavorite(project)}><Icon name="star" size={17} /></button>
                  <button type="button" aria-label={`${project.title} 복제`} onClick={() => props.onDuplicate(project)}><Icon name="copy" size={17} /></button>
                  <button type="button" aria-label={`${project.title} 내보내기`} onClick={() => props.onExport(project)}><Icon name="download" size={17} /></button>
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
