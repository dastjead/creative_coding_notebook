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
      <header className="section-header">
        <div>
          <p className="eyebrow">INBOX / NEW SOURCE</p>
          <h1 id="collect-heading">호기심을 붙잡아 두세요.</h1>
        </div>
        <button type="button" className="text-button" onClick={onCancel}>취소</button>
      </header>

      <div className="collect-grid">
        <div className="paper-form">
          <label>제목<input aria-label="제목" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="나중에 떠올릴 수 있는 이름" /></label>
          <label>출처 URL<input aria-label="출처 URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} inputMode="url" placeholder="https://…" /></label>
          <label className="code-paste-label">수집한 코드<textarea aria-label="수집한 코드" value={code} onChange={(event) => setCode(event.target.value)} placeholder={starter} spellCheck={false} /></label>
        </div>

        <aside className="profile-ticket">
          <p className="ticket-number">PROFILE / 01</p>
          <div className="profile-mark"><Icon name="code" size={28} /></div>
          <p className="profile-kicker">실행 프로필 제안</p>
          <h2>{selectedProfile.label}</h2>
          <p>{selectedProfile.description}</p>
          <label>직접 선택
            <select value={profileId} onChange={(event) => setManualProfile(event.target.value as RuntimeProfileId)}>
              {runtimeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <div className="confidence-line"><span style={{ width: `${Math.max(12, suggestions[0].confidence * 100)}%` }} /></div>
          <p className="reason">{suggestions.find((item) => item.profileId === profileId)?.reasons[0]}</p>
          <button type="button" className="primary-button" onClick={create} disabled={!code.trim()}>
            작업본 만들기 <Icon name="plus" />
          </button>
        </aside>
      </div>
    </section>
  );
}
