import { describe, expect, it } from 'vitest';
import { detectProfiles } from './profile-detector';

describe('detectProfiles', () => {
  it('ranks Shadertoy fragments as GLSL', () => {
    const matches = detectProfiles('void mainImage(out vec4 c, in vec2 p) { c = vec4(1.); }');
    expect(matches[0]).toMatchObject({ profileId: 'glsl-webgl2', confidence: 1 });
  });

  it('ranks p5 global sketches as p5', () => {
    const matches = detectProfiles('function setup(){createCanvas(300,300,WEBGL)}\nfunction draw(){sphere(40)}');
    expect(matches[0]?.profileId).toBe('p5-webgl');
  });

  it('ranks snippets that instantiate a three renderer as three', () => {
    const matches = detectProfiles('const renderer = new THREE.WebGLRenderer(); renderer.setAnimationLoop(render);');
    expect(matches[0]?.profileId).toBe('three-webgl');
  });

  it('returns all profiles with evidence so the user can override the suggestion', () => {
    const matches = detectProfiles('const value = 1;');
    expect(matches.map((match) => match.profileId)).toEqual([
      'p5-webgl',
      'three-webgl',
      'glsl-webgl2',
    ]);
    expect(matches.every((match) => match.reasons.length > 0)).toBe(true);
  });
});
