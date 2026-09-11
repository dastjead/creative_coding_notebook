import type { RuntimeProfileId } from '../domain/types';

export interface RuntimeProfile {
  id: RuntimeProfileId;
  label: string;
  language: 'glsl' | 'javascript';
  version: '1';
  runtimeVersion: string;
  description: string;
}

export interface PreparedGlsl {
  source: string;
}

export interface NormalizedRuntimeError {
  category: 'javascript' | 'shader' | 'unsupported' | 'asset' | 'security';
  message: string;
  line?: number;
  column?: number;
  raw?: string;
}

export const runtimeProfiles: RuntimeProfile[] = [
  {
    id: 'glsl-webgl2',
    label: 'GLSL / Shadertoy',
    language: 'glsl',
    version: '1',
    runtimeVersion: 'WebGL2',
    description: 'Fragment shader with main() or mainImage()',
  },
  {
    id: 'p5-webgl',
    label: 'p5.js WebGL',
    language: 'javascript',
    version: '1',
    runtimeVersion: '1.11.10',
    description: 'Single-file global-mode p5.js sketch',
  },
  {
    id: 'three-webgl',
    label: 'three.js WebGL',
    language: 'javascript',
    version: '1',
    runtimeVersion: '0.180.0',
    description: 'Single script with the THREE namespace available',
  },
];

export function getRuntimeProfile(id: RuntimeProfileId): RuntimeProfile {
  const profile = runtimeProfiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`Unknown runtime profile: ${id}`);
  return profile;
}

export function buildGlslFragment(code: string): PreparedGlsl {
  const versionMatch = code.match(/^\s*(#version\s+[^\n]+)\n?/);
  const version = versionMatch?.[1] ?? '#version 300 es';
  const userCode = versionMatch ? code.slice(versionMatch[0].length) : code;
  const firstUserLine = versionMatch ? 2 : 1;
  const compatibility = /\bgl_FragColor\b/.test(userCode) ? '#define gl_FragColor fragmentColor\n' : '';
  const hasMain = /\bvoid\s+main\s*\(/.test(userCode);
  const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(userCode);
  if (!hasMain && !hasMainImage) {
    throw new Error('GLSL requires void main() or Shadertoy mainImage().');
  }
  const adapter = hasMainImage && !hasMain
    ? '\n#line 1 0\nvoid main() { mainImage(fragmentColor, gl_FragCoord.xy); }\n'
    : '';
  return {
    source: [
      version,
      'precision highp float;',
      'uniform vec3 iResolution;',
      'uniform float iTime;',
      'uniform int iFrame;',
      'uniform vec4 iMouse;',
      'out vec4 fragmentColor;',
      compatibility.trimEnd(),
      `#line ${firstUserLine} 1`,
      userCode,
      adapter,
    ].filter(Boolean).join('\n'),
  };
}

export function parseShaderLog(raw: string): NormalizedRuntimeError {
  const webgl = raw.match(/(?:ERROR|WARNING):\s*(\d+):(\d+):\s*(.*)/i);
  if (webgl) {
    return {
      category: 'shader',
      message: webgl[3].trim(),
      line: Number(webgl[2]),
      raw,
    };
  }
  const alternate = raw.match(/\b\d+\((\d+)\)\s*:\s*(.*)/);
  return {
    category: 'shader',
    message: alternate?.[2]?.trim() || raw,
    line: alternate ? Number(alternate[1]) : undefined,
    raw,
  };
}
