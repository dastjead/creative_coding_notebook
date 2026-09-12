import { useEffect, useState } from 'react';
import { syncAdapter as defaultSyncAdapter } from '../sync';
import type { SyncAdapter } from '../sync/types';

interface SettingsViewProps {
  syncAdapter?: SyncAdapter;
}

export function SettingsView({ syncAdapter = defaultSyncAdapter }: SettingsViewProps) {
  const [persistence, setPersistence] = useState<'checking' | 'persistent' | 'best-effort' | 'unsupported'>('checking');
  const [storage, setStorage] = useState<{ usage: number; quota: number }>();
  const [email, setEmail] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    void checkPersistence();
  }, []);

  const checkPersistence = async () => {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    }
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

  const storagePercent = storage?.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;
  const persistenceLabel = persistence === 'persistent'
    ? '저장소 보호됨'
    : persistence === 'checking'
      ? '저장 상태 확인 중'
      : persistence === 'unsupported'
        ? '저장소 보호 지원 안 됨'
        : '저장소 보호 안 됨';

  const requestMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setSyncStatus('sending');
    try {
      await syncAdapter.signInMagicLink(email);
      setSyncStatus('sent');
    } catch {
      setSyncStatus('error');
    }
  };

  return (
    <section className="settings-view page-enter">
      <header className="section-header"><div><p className="eyebrow">기기 우선 저장</p><h1>저장 및 동기화</h1></div></header>
      <div className="settings-card">
        <div className={`storage-gauge ${persistence}`} role="meter" aria-label="기기 저장소 사용량" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(storagePercent)}><span style={{ width: `${storagePercent}%` }} /></div>
        <div><p className="eyebrow">기기 저장소</p><h2>{persistenceLabel}</h2><p>{persistence === 'persistent' ? '브라우저의 자동 정리 대상에서 제외됩니다. 사이트 데이터를 직접 삭제하면 노트도 함께 삭제됩니다.' : '브라우저 정책에 따라 데이터가 정리될 수 있습니다. 중요한 노트는 백업으로 내보내세요.'}</p>{storage && <p className="storage-usage">{formatBytes(storage.usage)} 사용 · {formatBytes(storage.quota)} 중</p>}</div>
        <button type="button" className="secondary-button" onClick={checkPersistence}>저장 상태 다시 확인</button>
      </div>
      {syncAdapter.enabled ? (
        <div className="settings-card">
          <div className="sync-stamp">동기화<br />가능</div>
          <div>
            <p className="eyebrow">클라우드 동기화</p>
            <h2>개인 동기화 연결</h2>
            <p>이메일로 받은 링크를 눌러 로그인합니다. 연결에 실패해도 이 기기의 노트는 계속 저장됩니다.</p>
            <form className="sync-form" onSubmit={requestMagicLink}>
              <label><span>이메일 주소</span><input name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <button type="submit" className="secondary-button" disabled={syncStatus === 'sending'}>로그인 링크 보내기</button>
            </form>
            <p className="sync-message" role="status">
              {syncStatus === 'sent' ? '이메일에서 로그인 링크를 확인하세요.' : syncStatus === 'error' ? '링크를 보내지 못했습니다. 연결 상태를 확인하세요.' : ''}
            </p>
          </div>
        </div>
      ) : (
        <div className="settings-card muted"><div className="sync-stamp">동기화<br />꺼짐</div><div><p className="eyebrow">클라우드 동기화</p><h2>이 기기에만 저장</h2><p>클라우드 동기화가 연결되지 않았습니다. 현재 노트는 이 기기에만 저장됩니다.</p></div></div>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
