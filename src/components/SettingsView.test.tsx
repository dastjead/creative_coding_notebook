import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import type { SyncAdapter } from '../sync/types';
import { SettingsView } from './SettingsView';

it('offers magic-link sign in only for a configured sync adapter', async () => {
  let requestedEmail = '';
  const adapter: SyncAdapter = {
    enabled: true,
    async signInMagicLink(email) { requestedEmail = email; },
    async push() { return { status: 'applied' }; },
  };
  const user = userEvent.setup();
  render(<SettingsView syncAdapter={adapter} />);

  await user.type(screen.getByLabelText('동기화 이메일'), 'artist@example.com');
  await user.click(screen.getByRole('button', { name: '로그인 링크 보내기' }));

  expect(requestedEmail).toBe('artist@example.com');
  expect(await screen.findByText('이메일에서 로그인 링크를 확인하세요.')).toBeInTheDocument();
});
