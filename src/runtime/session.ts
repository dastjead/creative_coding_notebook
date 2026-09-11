import type { RuntimeProfileId } from '../domain/types';
import { isRunnerEvent, RUNNER_CHANNEL, type RunnerAsset, type RunnerCommand, type RunnerEvent } from './protocol';

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
  private ready = false;
  private running = false;
  private lastHeartbeat = 0;
  private watchdog?: number;
  private pendingRun?: Extract<RunnerCommand, { type: 'RUN' }>;
  private readonly onMessage = (event: MessageEvent) => {
    if (event.source !== this.frame?.contentWindow) return;
    if (!isRunnerEvent(event.data, this.nonce, this.runId)) return;
    if (event.data.type === 'READY') {
      this.ready = true;
      if (this.pendingRun) {
        this.startRun(this.pendingRun);
        this.pendingRun = undefined;
      }
    }
    if (event.data.type === 'STARTED' || event.data.type === 'HEARTBEAT') this.lastHeartbeat = Date.now();
    if (event.data.type === 'ERROR' || event.data.type === 'STOPPED') this.running = false;
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
      this.watchdog = window.setInterval(() => this.checkHeartbeat(), 500);
      this.mounted = true;
    }
    this.replaceFrame();
  }

  run(profileId: RuntimeProfileId, code: string, size: { width: number; height: number; pixelRatio: number }, assets: RunnerAsset[] = []) {
    const command: Extract<RunnerCommand, { type: 'RUN' }> = {
      channel: RUNNER_CHANNEL,
      type: 'RUN',
      nonce: this.nonce,
      runId: this.runId,
      profileId,
      code,
      assets,
      ...size,
    };
    if (!this.ready) {
      this.pendingRun = command;
      return;
    }
    this.startRun(command);
  }

  stop() {
    this.replaceFrame();
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
    if (this.watchdog !== undefined) window.clearInterval(this.watchdog);
    this.watchdog = undefined;
    this.frame?.remove();
    this.frame = undefined;
    this.mounted = false;
  }

  private replaceFrame() {
    this.frame?.remove();
    this.ready = false;
    this.running = false;
    this.pendingRun = undefined;
    this.nonce = this.ids.nonce();
    this.runId = this.ids.runId();
    const frame = document.createElement('iframe');
    frame.title = 'Creative code preview';
    frame.setAttribute('sandbox', 'allow-scripts');
    const params = new URLSearchParams({ nonce: this.nonce, runId: this.runId });
    frame.src = `${import.meta.env.BASE_URL}runner.html?${params}`;
    frame.referrerPolicy = 'no-referrer';
    this.container.replaceChildren(frame);
    this.frame = frame;
  }

  private post(command: RunnerCommand) {
    this.frame?.contentWindow?.postMessage(command, '*');
  }

  private startRun(command: Extract<RunnerCommand, { type: 'RUN' }>) {
    this.running = true;
    this.lastHeartbeat = Date.now();
    this.post(command);
  }

  private checkHeartbeat() {
    if (!this.running || Date.now() - this.lastHeartbeat < 2_000) return;
    this.replaceFrame();
    this.eventHandler({
      channel: RUNNER_CHANNEL,
      type: 'ERROR',
      nonce: this.nonce,
      runId: this.runId,
      error: { category: 'javascript', message: '실행기가 응답하지 않아 격리 화면을 폐기했습니다.' },
    });
  }
}
