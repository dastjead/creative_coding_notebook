import type { ProfileMatch, RuntimeProfileId } from './types';

const PROFILE_ORDER: RuntimeProfileId[] = ['p5-webgl', 'three-webgl', 'glsl-webgl2'];

export function detectProfiles(code: string): ProfileMatch[] {
  const signals: Record<RuntimeProfileId, { score: number; reasons: string[] }> = {
    'glsl-webgl2': { score: 0, reasons: [] },
    'p5-webgl': { score: 0, reasons: [] },
    'three-webgl': { score: 0, reasons: [] },
  };

  addSignal(signals, 'glsl-webgl2', /\bmainImage\s*\(/, code, 100, 'Shadertoy mainImage entry point');
  addSignal(signals, 'glsl-webgl2', /\bgl_Frag(Color|Coord)\b|#version\s+300\s+es/, code, 70, 'GLSL fragment tokens');
  addSignal(signals, 'glsl-webgl2', /\bvec[234]\s*\(|\buniform\s+/, code, 35, 'GLSL vector or uniform syntax');

  addSignal(signals, 'p5-webgl', /\bfunction\s+(setup|draw)\s*\(/, code, 75, 'p5 lifecycle function');
  addSignal(signals, 'p5-webgl', /\bcreateCanvas\s*\(|\bWEBGL\b/, code, 45, 'p5 canvas API');
  addSignal(signals, 'p5-webgl', /\b(background|circle|rect|sphere|noise)\s*\(/, code, 20, 'p5 drawing API');

  addSignal(signals, 'three-webgl', /\bTHREE\./, code, 75, 'THREE namespace');
  addSignal(signals, 'three-webgl', /\bWebGLRenderer\s*\(|\bShaderMaterial\s*\(/, code, 55, 'three.js renderer or material');
  addSignal(signals, 'three-webgl', /\bsetAnimationLoop\s*\(|\brequestAnimationFrame\s*\(/, code, 15, 'animation loop');

  return PROFILE_ORDER.map((profileId) => ({
    profileId,
    confidence: Math.min(1, signals[profileId].score / 100),
    reasons: signals[profileId].reasons.length
      ? signals[profileId].reasons
      : ['No strong signature; manual selection is available'],
  })).sort((a, b) => b.confidence - a.confidence || PROFILE_ORDER.indexOf(a.profileId) - PROFILE_ORDER.indexOf(b.profileId));
}

function addSignal(
  signals: Record<RuntimeProfileId, { score: number; reasons: string[] }>,
  profileId: RuntimeProfileId,
  pattern: RegExp,
  code: string,
  score: number,
  reason: string,
) {
  if (pattern.test(code)) {
    signals[profileId].score += score;
    signals[profileId].reasons.push(reason);
  }
}
