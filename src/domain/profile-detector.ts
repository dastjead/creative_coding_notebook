import type { ProfileMatch, RuntimeProfileId } from './types';

const PROFILE_ORDER: RuntimeProfileId[] = ['p5-webgl', 'three-webgl', 'glsl-webgl2'];

export function detectProfiles(code: string): ProfileMatch[] {
  const signals: Record<RuntimeProfileId, { score: number; reasons: string[] }> = {
    'glsl-webgl2': { score: 0, reasons: [] },
    'p5-webgl': { score: 0, reasons: [] },
    'three-webgl': { score: 0, reasons: [] },
  };

  addSignal(signals, 'glsl-webgl2', /\bmainImage\s*\(/, code, 100, 'Shadertoy mainImage() 함수를 감지했습니다.');
  addSignal(signals, 'glsl-webgl2', /(?=[\s\S]*\bFC\b)(?=[\s\S]*\bo(?:\.[rgba]{1,4})?\s*(?:[+*/-]?=))/, code, 100, 'twigl 본문 축약형 FC와 o를 감지했습니다.');
  addSignal(signals, 'glsl-webgl2', /\bgl_Frag(Color|Coord)\b|#version\s+300\s+es/, code, 70, 'GLSL 조각 셰이더 구문을 감지했습니다.');
  addSignal(signals, 'glsl-webgl2', /\bvec[234]\s*\(|\buniform\s+/, code, 35, 'GLSL 벡터 또는 uniform 구문을 감지했습니다.');

  addSignal(signals, 'p5-webgl', /\bfunction\s+(setup|draw)\s*\(/, code, 75, 'p5.js setup() 또는 draw() 함수를 감지했습니다.');
  addSignal(signals, 'p5-webgl', /\bcreateCanvas\s*\(|\bWEBGL\b/, code, 45, 'p5.js WebGL 캔버스 구문을 감지했습니다.');
  addSignal(signals, 'p5-webgl', /\b(background|circle|rect|sphere|noise)\s*\(/, code, 20, 'p5.js 그리기 함수를 감지했습니다.');

  addSignal(signals, 'three-webgl', /\bTHREE\./, code, 75, 'THREE 전역 객체를 감지했습니다.');
  addSignal(signals, 'three-webgl', /\bWebGLRenderer\s*\(|\bShaderMaterial\s*\(/, code, 55, 'three.js 렌더러 또는 재질을 감지했습니다.');
  addSignal(signals, 'three-webgl', /\bsetAnimationLoop\s*\(|\brequestAnimationFrame\s*\(/, code, 15, '애니메이션 반복 구문을 감지했습니다.');

  return PROFILE_ORDER.map((profileId) => ({
    profileId,
    confidence: Math.min(1, signals[profileId].score / 100),
    reasons: signals[profileId].reasons.length
      ? signals[profileId].reasons
      : ['뚜렷한 실행 형식을 찾지 못했습니다. 직접 선택해 주세요.'],
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
