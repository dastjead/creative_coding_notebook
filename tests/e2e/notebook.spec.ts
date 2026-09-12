import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = (path: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', path), 'utf8');

test('collects and renders a GLSL experiment in the isolated runner', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 노트' }).first().click();
  await page.getByLabel('제목').fill('Red current');
  await page.getByLabel('출처 URL').fill('https://example.com/red');
  await page.getByLabel('원본 코드').fill(`void mainImage(out vec4 color, in vec2 point) {
    vec2 uv = point / iResolution.xy;
    color = vec4(uv.x, 0.08, uv.y, 0.0);
  }`);
  await expect(page.getByRole('heading', { name: 'GLSL / Shadertoy' })).toBeVisible();
  await page.getByRole('button', { name: '노트 만들기' }).click();
  await expect(page.getByLabel('노트 제목')).toHaveValue('Red current');
  await page.getByRole('button', { name: '실행', exact: true }).click();

  const runner = page.frameLocator('iframe[title="크리에이티브 코드 미리보기"]');
  await expect(runner.locator('canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('실행 중', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '캡처' }).click();
  await expect(page.getByRole('status')).toContainText('캡처를 저장했습니다.');
  await page.getByText('노트 정보와 파일').click();
  const capture = page.getByAltText('Red current 캡처');
  await expect(capture).toBeVisible();
  const centerAlpha = await capture.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    return context.getImageData(Math.floor(sample.width / 2), Math.floor(sample.height / 2), 1, 1).data[3];
  });
  expect(centerAlpha).toBe(255);
  await page.getByRole('button', { name: '보관함', exact: true }).click();
  await expect(page.getByAltText('대표 캡처')).toBeVisible();
});

test('wraps and renders a twigl geekest golf body', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 노트' }).first().click();
  await page.getByLabel('제목').fill('Twigl golf');
  await page.getByLabel('원본 코드').fill(fixture('glsl/twigl-geekest.glsl'));
  await expect(page.getByRole('heading', { name: 'GLSL / Shadertoy' })).toBeVisible();
  await page.getByRole('button', { name: '노트 만들기' }).click();
  await page.getByRole('button', { name: '실행', exact: true }).click();

  await expect(page.frameLocator('iframe[title="크리에이티브 코드 미리보기"]').locator('canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('실행 중', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('keeps a saved project across a page reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 노트' }).first().click();
  await page.getByLabel('제목').fill('Persistent orbit');
  await page.getByLabel('원본 코드').fill('function setup(){ createCanvas(200, 200, WEBGL); }');
  await page.getByRole('button', { name: '노트 만들기' }).click();
  await expect(page.getByLabel('노트 제목')).toHaveValue('Persistent orbit');
  await page.getByRole('button', { name: '보관함', exact: true }).click();
  await expect(page.getByText('Persistent orbit')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Persistent orbit')).toBeVisible();
});

test('reopens the installed app shell and local archive while offline', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot reload a page after context.setOffline(true); cover on real Safari.');
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service worker unsupported');
    await navigator.serviceWorker.ready;
  });
  await page.getByRole('button', { name: '새 노트' }).first().click();
  await page.getByLabel('제목').fill('Offline field');
  await page.getByLabel('원본 코드').fill(fixture('glsl/success.glsl'));
  await page.getByRole('button', { name: '노트 만들기' }).click();
  await page.getByRole('button', { name: '보관함', exact: true }).click();
  await expect(page.getByText('Offline field')).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByText('Offline field')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

for (const profile of [
  { name: 'p5.js', path: 'p5/success.js', suggested: 'p5.js WebGL' },
  { name: 'three.js', path: 'three/success.js', suggested: 'three.js WebGL' },
]) {
  test(`runs the bundled ${profile.name} profile without a network dependency`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '새 노트' }).first().click();
    await page.getByLabel('제목').fill(`${profile.name} fixture`);
    await page.getByLabel('원본 코드').fill(fixture(profile.path));
    await expect(page.getByRole('heading', { name: profile.suggested })).toBeVisible();
    await page.getByRole('button', { name: '노트 만들기' }).click();
    await page.getByRole('button', { name: '실행', exact: true }).click();

    await expect(page.frameLocator('iframe[title="크리에이티브 코드 미리보기"]').locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('실행 중', { exact: true })).toBeVisible();
  });
}

test('keeps the runner away from network, popups, host navigation, and browser storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 노트' }).first().click();
  await page.getByLabel('원본 코드').fill(fixture('three/success.js'));
  await page.getByRole('button', { name: '노트 만들기' }).click();
  await page.getByText('노트 정보와 파일').click();
  await page.getByLabel('파일 추가').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByText('pixel.png')).toBeVisible();
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect(page.frameLocator('iframe[title="크리에이티브 코드 미리보기"]').locator('canvas')).toBeVisible();
  const runnerBody = page.frameLocator('iframe[title="크리에이티브 코드 미리보기"]').locator('body');
  await runnerBody.waitFor({ state: 'attached' });

  const result = await runnerBody.evaluate(async () => {
    let fetchBlocked = false;
    let storageBlocked = false;
    let navigationBlocked = false;
    try { await fetch('https://example.com/forbidden'); } catch { fetchBlocked = true; }
    try { localStorage.setItem('forbidden', '1'); } catch { storageBlocked = true; }
    try { window.top!.location.href = 'https://example.com/forbidden'; } catch { navigationBlocked = true; }
    const popup = window.open('about:blank');
    popup?.close();
    return { fetchBlocked, storageBlocked, navigationBlocked, popupBlocked: popup === null, assetNames: Object.keys((window as typeof window & { ASSETS?: object }).ASSETS ?? {}) };
  });

  expect(result).toEqual({ fetchBlocked: true, storageBlocked: true, navigationBlocked: true, popupBlocked: true, assetNames: ['pixel.png'] });
  await expect(page).toHaveURL(/127\.0\.0\.1:4173/);
});

test('reports a missing local asset separately from JavaScript errors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 노트' }).first().click();
  await page.getByLabel('원본 코드').fill(fixture('three/missing-asset.js'));
  await page.getByRole('button', { name: '노트 만들기' }).click();
  await page.getByRole('button', { name: '실행', exact: true }).click();

  const error = page.getByRole('alert');
  await expect(error).toContainText('파일 오류');
  await expect(error).toContainText('missing-texture.png');
});
