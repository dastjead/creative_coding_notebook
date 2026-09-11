import P5 from 'p5';
import * as THREE from 'three';
import { buildGlslFragment, parseShaderLog, type NormalizedRuntimeError } from '../runtime/profiles';
import { RUNNER_CHANNEL, type RunnerCommand, type RunnerEventPayload } from '../runtime/protocol';

const params = new URLSearchParams(location.search);
const nonce = params.get('nonce') ?? '';
const runId = params.get('runId') ?? '';
let cleanup: (() => void) | undefined;
let assetUrls: string[] = [];
let currentSize = { width: innerWidth, height: innerHeight, pixelRatio: Math.min(devicePixelRatio, 1.5) };

function emit(event: RunnerEventPayload) {
  parent.postMessage({ ...event, channel: RUNNER_CHANNEL, nonce, runId }, '*');
}

function fail(error: unknown, category?: NormalizedRuntimeError['category']) {
  const candidate = error instanceof Error ? error : new Error(String(error));
  const resolvedCategory = category ?? (candidate.name === 'AssetError' ? 'asset' : 'javascript');
  emit({
    type: 'ERROR',
    error: { category: resolvedCategory, message: candidate.message, raw: candidate.stack },
  });
}

function resetDocument() {
  cleanup?.();
  cleanup = undefined;
  document.body.replaceChildren();
  assetUrls.forEach((url) => URL.revokeObjectURL(url));
  assetUrls = [];
  Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: '#10100f' });
  delete (window as Window & { setup?: unknown }).setup;
  delete (window as Window & { draw?: unknown }).draw;
  delete (window as Window & { ASSETS?: unknown }).ASSETS;
}

window.addEventListener('error', (event) => {
  emit({ type: 'ERROR', error: { category: 'javascript', message: event.message, line: event.lineno, column: event.colno } });
});

window.addEventListener('unhandledrejection', (event) => fail(event.reason));

window.addEventListener('message', (event: MessageEvent<RunnerCommand>) => {
  const command = event.data;
  if (!command || command.channel !== RUNNER_CHANNEL || command.nonce !== nonce || command.runId !== runId) return;
  if (command.type === 'RUN') {
    currentSize = { width: command.width, height: command.height, pixelRatio: Math.min(command.pixelRatio, 2) };
    resetDocument();
    installAssets(command.assets ?? []);
    try {
      if (command.profileId === 'glsl-webgl2') cleanup = runGlsl(command.code);
      if (command.profileId === 'p5-webgl') cleanup = runP5(command.code);
      if (command.profileId === 'three-webgl') cleanup = runThree(command.code);
      emit({ type: 'STARTED' });
    } catch (error) {
      fail(error, command.profileId === 'glsl-webgl2' ? 'shader' : undefined);
    }
  }
  if (command.type === 'STOP') {
    resetDocument();
    emit({ type: 'STOPPED' });
  }
  if (command.type === 'RESET') resetDocument();
  if (command.type === 'RESIZE') {
    currentSize = { width: command.width, height: command.height, pixelRatio: Math.min(command.pixelRatio, 2) };
    resizeFirstCanvas();
  }
  if (command.type === 'CAPTURE') captureFirstCanvas();
});

setInterval(() => emit({ type: 'HEARTBEAT' }), 500);
emit({ type: 'READY' });

function runP5(code: string) {
  const assets = (window as Window & { ASSETS?: Readonly<Record<string, string>> }).ASSETS ?? {};
  const evaluate = new Function('window', 'ASSETS', `${code}\n;window.setup = typeof setup === 'function' ? setup : undefined;window.draw = typeof draw === 'function' ? draw : undefined;`);
  evaluate(window, assets);
  const GlobalP5 = P5 as unknown as new () => P5;
  const instance = new GlobalP5();
  return () => instance.remove();
}

function runThree(code: string) {
  (window as Window & { THREE?: typeof THREE }).THREE = THREE;
  const assets = (window as Window & { ASSETS?: Readonly<Record<string, string>> }).ASSETS ?? {};
  const evaluate = new Function('THREE', 'ASSETS', code);
  evaluate(THREE, assets);
  resizeFirstCanvas();
  return () => {
    delete (window as Window & { THREE?: typeof THREE }).THREE;
  };
}

function installAssets(assets: NonNullable<Extract<RunnerCommand, { type: 'RUN' }>['assets']>) {
  const entries = assets.map((asset) => {
    const url = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mimeType }));
    assetUrls.push(url);
    return [asset.name, url] as const;
  });
  const urls = Object.freeze(Object.fromEntries(entries));
  (window as Window & { ASSETS?: Readonly<Record<string, string>> }).ASSETS = new Proxy(urls, {
    get(target, property, receiver) {
      if (typeof property === 'string' && !(property in target)) {
        const error = new Error(`로컬 에셋을 찾을 수 없습니다: ${property}`);
        error.name = 'AssetError';
        throw error;
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function runGlsl(code: string) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec2 position;
    void main(){ gl_Position = vec4(position, 0.0, 1.0); }`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, buildGlslFragment(code).source);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader link failed.');
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  const started = performance.now();
  let frame = 0;
  let animation = 0;
  const draw = (now: number) => {
    resizeCanvas(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(gl.getUniformLocation(program, 'iResolution'), canvas.width, canvas.height, 1);
    gl.uniform1f(gl.getUniformLocation(program, 'iTime'), (now - started) / 1000);
    gl.uniform1i(gl.getUniformLocation(program, 'iFrame'), frame++);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    animation = requestAnimationFrame(draw);
  };
  animation = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(animation);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
  };
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const raw = gl.getShaderInfoLog(shader) ?? 'Shader compilation failed.';
    const parsed = parseShaderLog(raw);
    const error = new Error(parsed.message);
    Object.assign(error, parsed);
    throw error;
  }
  return shader;
}

function resizeFirstCanvas() {
  const canvas = document.querySelector('canvas');
  if (canvas) resizeCanvas(canvas);
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const width = Math.max(1, Math.floor(currentSize.width * currentSize.pixelRatio));
  const height = Math.max(1, Math.floor(currentSize.height * currentSize.pixelRatio));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = `${currentSize.width}px`;
  canvas.style.height = `${currentSize.height}px`;
}

function captureFirstCanvas() {
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    fail('No canvas is available to capture.', 'asset');
    return;
  }
  try {
    emit({ type: 'CAPTURED', dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
  } catch (error) {
    fail(error, 'security');
  }
}
