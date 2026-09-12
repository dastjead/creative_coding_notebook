import { useMemo, useState } from 'react';
import { detectProfiles } from '../domain/profile-detector';
import type { RuntimeProfileId } from '../domain/types';
import { runtimeProfiles } from '../runtime/profiles';
import type { DexieProjectRepository } from '../storage/repository';
import { Icon } from './Icon';

interface CollectViewProps {
  repository: DexieProjectRepository;
  onCreated(projectId: string): void;
  onCancel(): void;
}

const starter = `void mainImage(out vec4 color, in vec2 point) {
  vec2 uv = (point * 2.0 - iResolution.xy) / iResolution.y;
  float glow = 0.05 / abs(length(uv) - 0.35);
  color = vec4(glow * vec3(1.0, 0.16, 0.05), 1.0);
}`;

export function CollectView({ repository, onCreated, onCancel }: CollectViewProps) {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [code, setCode] = useState('');
  const suggestions = useMemo(() => detectProfiles(code), [code]);
  const [manualProfile, setManualProfile] = useState<RuntimeProfileId>();
  const profileId = manualProfile ?? suggestions[0].profileId;
  const selectedProfile = runtimeProfiles.find((profile) => profile.id === profileId)!;

  const create = async () => {
    if (!code.trim()) return;
    const aggregate = await repository.create({ title, sourceUrl, code, profileId });
    onCreated(aggregate.project.id);
  };

  return (
    <section className="collect-view page-enter" aria-labelledby="collect-heading">
      <header className="section-header collect-header">
        <div>
          <p className="eyebrow">새로운 원본</p>
          <h1 id="collect-heading">새 코드 수집</h1>
          <p className="section-lede">호기심이 사라지기 전에 원본 그대로 붙잡아 두세요.</p>
        </div>
        <button type="button" className="text-button" onClick={onCancel}>취소</button>
      </header>

      <form className="collect-grid" onSubmit={(event) => { event.preventDefault(); void create(); }}>
        <div className="paper-form">
          <label>제목<input name="note-title" autoComplete="off" aria-label="제목" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="나중에 떠올릴 수 있는 이름" /></label>
          <label>출처 URL<input name="source-url" type="url" autoComplete="url" aria-label="출처 URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} inputMode="url" placeholder="https://…" /></label>
          <label className="code-paste-label">원본 코드<textarea name="original-code" aria-label="원본 코드" value={code} onChange={(event) => setCode(event.target.value)} placeholder={starter} spellCheck={false} /></label>
        </div>

        <aside className="profile-ticket">
          <p className="ticket-number">실행 방식 · 01</p>
          <div className="profile-mark"><Icon name="code" size={28} /></div>
          <p className="profile-kicker">감지된 실행 방식</p>
          <h2>{selectedProfile.label}</h2>
          <p>{selectedProfile.description}</p>
          <label>실행 방식 변경
            <select name="runtime-profile" value={profileId} onChange={(event) => setManualProfile(event.target.value as RuntimeProfileId)}>
              {runtimeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <div className="confidence-line" role="meter" aria-label="실행 방식 감지 신뢰도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(suggestions[0].confidence * 100)}><span style={{ width: `${Math.max(12, suggestions[0].confidence * 100)}%` }} /></div>
          <p className="reason">{suggestions.find((item) => item.profileId === profileId)?.reasons[0]}</p>
          <button type="submit" className="primary-button" disabled={!code.trim()}>
            노트 만들기 <Icon name="plus" />
          </button>
        </aside>
      </form>
    </section>
  );
}
