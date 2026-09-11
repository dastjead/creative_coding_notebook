import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export function SettingsView() {
  const [persistence, setPersistence] = useState<'checking' | 'persistent' | 'best-effort' | 'unsupported'>('checking');

  useEffect(() => {
    void checkPersistence();
  }, []);

  const checkPersistence = async () => {
    if (!navigator.storage?.persisted) {
      setPersistence('unsupported');
      return;
    }
    if (await navigator.storage.persisted()) {
      setPersistence('persistent');
      return;
    }
    const granted = navigator.storage.persist ? await navigator.storage.persist() : false;
    setPersistence(granted ? 'persistent' : 'best-effort');
  };

  return (
    <section className="settings-view page-enter">
      <header className="section-header"><div><p className="eyebrow">SYSTEM / LOCAL FIRST</p><h1>보존 상태</h1></div><Icon name="settings" size={32} /></header>
      <div className="settings-card">
        <div className={`storage-gauge ${persistence}`}><span /></div>
        <div><p className="eyebrow">BROWSER STORAGE</p><h2>{persistence === 'persistent' ? '지속 저장 허용됨' : persistence === 'checking' ? '확인 중' : '최선형 저장'}</h2><p>브라우저 저장소는 운영체제 정책에 따라 정리될 수 있습니다. 중요한 작업은 프로젝트 메뉴에서 ZIP으로 내보내세요.</p></div>
        <button type="button" className="secondary-button" onClick={checkPersistence}>다시 확인</button>
      </div>
      <div className="settings-card muted"><div className="sync-stamp">SYNC<br />OFF</div><div><p className="eyebrow">CLOUD ADAPTER</p><h2>로컬 모드</h2><p>Supabase 환경 변수가 없으므로 모든 데이터는 이 기기의 IndexedDB에만 저장됩니다.</p></div></div>
    </section>
  );
}
