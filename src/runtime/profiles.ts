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
    description: 'GLSL 조각 셰이더입니다. main(), mainImage(), twigl 본문 형식을 지원합니다.',
  },
  {
    id: 'p5-webgl',
    label: 'p5.js WebGL',
    language: 'javascript',
    version: '1',
    runtimeVersion: '1.11.10',
    description: '단일 파일로 작성된 p5.js 전역 모드 WebGL 스케치입니다.',
  },
  {
    id: 'three-webgl',
    label: 'three.js WebGL',
    language: 'javascript',
    version: '1',
    runtimeVersion: '0.180.0',
    description: 'THREE 전역 객체를 사용하는 three.js WebGL 스크립트입니다.',
  },
];

export function getRuntimeProfile(id: RuntimeProfileId): RuntimeProfile {
  const profile = runtimeProfiles.find((candidate) => candidate.id === id);
  if (!profile) throw new Error(`지원하지 않는 실행 방식입니다: ${id}`);
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
  const isTwiglGeekestBody = !hasMain && !hasMainImage
    && /\bFC\b/.test(userCode)
    && /\bo(?:\.[rgba]{1,4})?\s*(?:[+*/-]?=)/.test(userCode);
  if (!hasMain && !hasMainImage && !isTwiglGeekestBody) {
    throw new Error('GLSL 코드를 실행할 수 없습니다. main(), mainImage(), 또는 FC와 o를 사용하는 twigl 본문 형식이 필요합니다.');
  }
  const aliases = isTwiglGeekestBody
    ? '#define FC gl_FragCoord\n#define r iResolution.xy\n#define t iTime\n#define o fragmentColor'
    : '';
  const wrappedUserCode = isTwiglGeekestBody
    ? `void main() {\n  fragmentColor = vec4(0.0);\n#line ${firstUserLine} 1\n${userCode}\n}`
    : `#line ${firstUserLine} 1\n${userCode}`;
  const adapter = hasMainImage && !hasMain && !isTwiglGeekestBody
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
      aliases,
      wrappedUserCode,
      adapter,
    ].filter(Boolean).join('\n'),
  };
}

export function parseShaderLog(raw: string): NormalizedRuntimeError {
  const webgl = raw.match(/(?:ERROR|WARNING):\s*(\d+):(\d+):\s*(.*)/i);
  if (webgl) {
    return {
      category: 'shader',
      message: explainShaderMessage(webgl[3].trim()),
      line: Number(webgl[2]),
      raw,
    };
  }
  const alternate = raw.match(/\b\d+\((\d+)\)\s*:\s*(.*)/);
  return {
    category: 'shader',
    message: explainShaderMessage(alternate?.[2]?.trim() || raw),
    line: alternate ? Number(alternate[1]) : undefined,
    raw,
  };
}

function explainShaderMessage(message: string): string {
  const overload = message.match(/^'([^']+)'\s*:\s*no matching overloaded function found$/i);
  if (!overload) return message;
  return `\`${overload[1]}\` 호출과 일치하는 함수 선언이 없습니다. 인수의 개수와 타입(vec2, vec3, float 등)을 확인하세요.`;
}
