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

  it('wraps a twigl geekest body without changing the collected golf code', () => {
    const code = 'for(float z,d,i,f,h;i++<1e2;z+=d){vec3 p=z*normalize(vec3(FC.xy-.5*r,r.y*.5));p.z+=t;h=.8;for(f=1.0472;f<2e2;f+=f)h+=abs(dot(sin(p.xz*f*.4+t*f+cos(p.zx*f*.6)),vec2(.4)))/f;d=.01+abs(p.y-h*2.+p.x*.7)*.2;o.rgb+=(vec3(.05,.1,.15)+h*vec3(.1))/d*2e-3;}o=tanh(o*o);';

    const prepared = buildGlslFragment(code);

    expect(prepared.source).toContain('#define FC gl_FragCoord');
    expect(prepared.source).toContain('#define r iResolution.xy');
    expect(prepared.source).toContain('#define t iTime');
    expect(prepared.source).toContain('#define o fragmentColor');
    expect(prepared.source).toContain(`#line 1 1\n${code}`);
    expect(prepared.source).toContain('void main()');
  });

  it('keeps an explicit mainImage function out of the twigl body wrapper', () => {
    const code = '#define FC gl_FragCoord\nvoid mainImage(out vec4 o, in vec2 point) { o = vec4(FC.xy / iResolution.xy, 0., 1.); }';

    const prepared = buildGlslFragment(code);

    expect(prepared.source).not.toContain('fragmentColor = vec4(0.0);');
    expect(prepared.source).toContain('void main() { mainImage(fragmentColor, gl_FragCoord.xy); }');
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
