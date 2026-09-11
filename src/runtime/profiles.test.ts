import { describe, expect, it } from 'vitest';
import { buildGlslFragment, parseShaderLog, runtimeProfiles } from './profiles';

describe('runtime profiles', () => {
  it('adapts a Shadertoy mainImage without rewriting the collected code', () => {
    const code = 'void mainImage(out vec4 color, in vec2 point) {\n  color = vec4(point, 0., 1.);\n}';
    const prepared = buildGlslFragment(code);

    expect(prepared.source).toContain('#line 1 1\n' + code);
    expect(prepared.source).toContain('void main() { mainImage(fragmentColor, gl_FragCoord.xy); }');
    expect(code.startsWith('void mainImage')).toBe(true);
  });

  it('does not append a second main function to native GLSL fragments', () => {
    const prepared = buildGlslFragment('void main(){ fragmentColor = vec4(1.); }');
    expect(prepared.source.match(/void main\s*\(/g)).toHaveLength(1);
  });

  it('maps source-string-one shader errors directly to user lines', () => {
    expect(parseShaderLog('ERROR: 1:7: syntax error')).toEqual({
      category: 'shader',
      message: 'syntax error',
      line: 7,
      raw: 'ERROR: 1:7: syntax error',
    });
  });

  it('publishes the three fixed MVP profiles', () => {
    expect(runtimeProfiles.map((profile) => profile.id)).toEqual([
      'glsl-webgl2',
      'p5-webgl',
      'three-webgl',
    ]);
    expect(runtimeProfiles.every((profile) => profile.version === '1')).toBe(true);
  });
});
