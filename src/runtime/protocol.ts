import type { RuntimeProfileId } from '../domain/types';
import type { NormalizedRuntimeError } from './profiles';

export const RUNNER_CHANNEL = 'creative-notebook-runner' as const;

export interface RunnerAsset {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
}

export type RunnerCommand =
  | { channel: typeof RUNNER_CHANNEL; type: 'RUN'; nonce: string; runId: string; profileId: RuntimeProfileId; code: string; width: number; height: number; pixelRatio: number; assets?: RunnerAsset[] }
  | { channel: typeof RUNNER_CHANNEL; type: 'STOP' | 'RESET' | 'CAPTURE'; nonce: string; runId: string }
  | { channel: typeof RUNNER_CHANNEL; type: 'RESIZE'; nonce: string; runId: string; width: number; height: number; pixelRatio: number };

export type RunnerEvent =
  | { channel: typeof RUNNER_CHANNEL; type: 'READY' | 'STARTED' | 'HEARTBEAT' | 'STOPPED'; nonce: string; runId: string }
  | { channel: typeof RUNNER_CHANNEL; type: 'CONSOLE'; nonce: string; runId: string; level: 'log' | 'warn' | 'error'; message: string }
  | { channel: typeof RUNNER_CHANNEL; type: 'ERROR'; nonce: string; runId: string; error: NormalizedRuntimeError }
  | { channel: typeof RUNNER_CHANNEL; type: 'CAPTURED'; nonce: string; runId: string; dataUrl: string; width: number; height: number };

export type RunnerEventPayload = RunnerEvent extends infer Event
  ? Event extends unknown
    ? Omit<Event, 'channel' | 'nonce' | 'runId'>
    : never
  : never;

const eventTypes = new Set(['READY', 'STARTED', 'HEARTBEAT', 'STOPPED', 'CONSOLE', 'ERROR', 'CAPTURED']);

export function isRunnerEvent(value: unknown, nonce: string, runId: string): value is RunnerEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.channel === RUNNER_CHANNEL
    && candidate.nonce === nonce
    && candidate.runId === runId
    && typeof candidate.type === 'string'
    && eventTypes.has(candidate.type);
}
