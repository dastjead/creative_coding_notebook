import { describe, expect, it, vi } from 'vitest';
import { RunnerSession } from './session';

describe('RunnerSession', () => {
  it('creates a scripts-only sandbox and replaces it on hard reset', () => {
    const container = document.createElement('div');
    const session = new RunnerSession(container, { nonce: () => 'safe-nonce', runId: () => 'run-1' });
    session.mount();
    const first = container.querySelector('iframe');

    session.hardReset();
    const second = container.querySelector('iframe');

    expect(first).not.toBe(second);
    expect(second?.getAttribute('sandbox')).toBe('allow-scripts');
    expect(second?.src).toContain('/runner.html');
    session.dispose();
  });

  it('ignores events that did not come from the current frame', () => {
    const container = document.createElement('div');
    const onEvent = vi.fn();
    const session = new RunnerSession(
      container,
      { nonce: () => 'safe-nonce', runId: () => 'run-1' },
      onEvent,
    );
    session.mount();

    window.dispatchEvent(new MessageEvent('message', {
      data: { channel: 'creative-notebook-runner', type: 'READY', nonce: 'safe-nonce', runId: 'run-1' },
      source: window,
    }));

    expect(onEvent).not.toHaveBeenCalled();
    session.dispose();
  });
});
