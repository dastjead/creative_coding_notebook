import { describe, expect, it } from 'vitest';
import { isRunnerEvent } from './protocol';

describe('runner protocol validation', () => {
  const event = {
    channel: 'creative-notebook-runner',
    type: 'READY',
    nonce: 'nonce-a',
    runId: 'run-a',
  };

  it('accepts an event only for the active nonce and run', () => {
    expect(isRunnerEvent(event, 'nonce-a', 'run-a')).toBe(true);
  });

  it('accepts the rendered signal used to time automatic captures', () => {
    expect(isRunnerEvent({ ...event, type: 'RENDERED' }, 'nonce-a', 'run-a')).toBe(true);
  });

  it('rejects stale runs and forged nonces', () => {
    expect(isRunnerEvent(event, 'nonce-b', 'run-a')).toBe(false);
    expect(isRunnerEvent(event, 'nonce-a', 'run-b')).toBe(false);
  });

  it('rejects unknown message types and malformed payloads', () => {
    expect(isRunnerEvent({ ...event, type: 'OPEN_DATABASE' }, 'nonce-a', 'run-a')).toBe(false);
    expect(isRunnerEvent(null, 'nonce-a', 'run-a')).toBe(false);
  });
});
