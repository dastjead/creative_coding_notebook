import type { RuntimeProfileId } from '../domain/types';
import { isRunnerEvent, RUNNER_CHANNEL, type RunnerCommand, type RunnerEvent } from './protocol';

interface SessionIds {
  nonce(): string;
  runId(): string;
}

const defaultIds: SessionIds = {
  nonce: () => crypto.randomUUID(),
  runId: () => crypto.randomUUID(),
};

export class RunnerSession {
  private frame?: HTMLIFrameElement;
  private nonce = '';
  private runId = '';
  private mounted = false;
  private readonly onMessage = (event: MessageEvent) => {
    if (event.source !== this.frame?.contentWindow) return;
    if (!isRunnerEvent(event.data, this.nonce, this.runId)) return;
    this.eventHandler(event.data);
  };

  constructor(
    private readonly container: HTMLElement,
    private readonly ids: SessionIds = defaultIds,
    private readonly eventHandler: (event: RunnerEvent) => void = () => undefined,
  ) {}

  mount() {
    if (!this.mounted) {
      window.addEventListener('message', this.onMessage);
      this.mounted = true;
    }
    this.replaceFrame();
  }

  run(profileId: RuntimeProfileId, code: string, size: { width: number; height: number; pixelRatio: number }) {
    this.post({
      channel: RUNNER_CHANNEL,
      type: 'RUN',
      nonce: this.nonce,
      runId: this.runId,
      profileId,
      code,
      ...size,
    });
  }

  stop() {
    this.post({ channel: RUNNER_CHANNEL, type: 'STOP', nonce: this.nonce, runId: this.runId });
  }

  capture() {
    this.post({ channel: RUNNER_CHANNEL, type: 'CAPTURE', nonce: this.nonce, runId: this.runId });
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.post({ channel: RUNNER_CHANNEL, type: 'RESIZE', nonce: this.nonce, runId: this.runId, width, height, pixelRatio });
  }

  hardReset() {
    this.replaceFrame();
  }

  dispose() {
    window.removeEventListener('message', this.onMessage);
    this.frame?.remove();
    this.frame = undefined;
    this.mounted = false;
  }

  private replaceFrame() {
    this.frame?.remove();
    this.nonce = this.ids.nonce();
    this.runId = this.ids.runId();
    const frame = document.createElement('iframe');
    frame.title = 'Creative code preview';
    frame.setAttribute('sandbox', 'allow-scripts');
    const params = new URLSearchParams({ nonce: this.nonce, runId: this.runId });
    frame.src = `/runner.html?${params}`;
    frame.referrerPolicy = 'no-referrer';
    this.container.replaceChildren(frame);
    this.frame = frame;
  }

  private post(command: RunnerCommand) {
    this.frame?.contentWindow?.postMessage(command, '*');
  }
}
