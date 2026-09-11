import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = (path: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures', path), 'utf8');

test('collects and renders a GLSL experiment in the isolated runner', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 실험' }).first().click();
  await page.getByLabel('제목').fill('Red current');
  await page.getByLabel('출처 URL').fill('https://example.com/red');
  await page.getByLabel('수집한 코드').fill(`void mainImage(out vec4 color, in vec2 point) {
    vec2 uv = point / iResolution.xy;
    color = vec4(uv.x, 0.08, uv.y, 1.0);
  }`);
  await expect(page.getByRole('heading', { name: 'GLSL / Shadertoy' })).toBeVisible();
  await page.getByRole('button', { name: '작업본 만들기' }).click();
  await expect(page.getByLabel('프로젝트 제목')).toHaveValue('Red current');
  await page.getByRole('button', { name: '실행' }).click();

  const runner = page.frameLocator('iframe[title="Creative code preview"]');
  await expect(runner.locator('canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('RUNNING', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '캡처' }).click();
  await expect(page.getByAltText('Red current 캡처')).toBeVisible();
  await page.getByRole('button', { name: 'ARCHIVE' }).click();
  await expect(page.getByAltText('대표 캡처')).toBeVisible();
});

test('keeps a saved project across a page reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 실험' }).first().click();
  await page.getByLabel('제목').fill('Persistent orbit');
  await page.getByLabel('수집한 코드').fill('function setup(){ createCanvas(200, 200, WEBGL); }');
  await page.getByRole('button', { name: '작업본 만들기' }).click();
  await expect(page.getByLabel('프로젝트 제목')).toHaveValue('Persistent orbit');
  await page.getByRole('button', { name: 'ARCHIVE' }).click();
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
  await page.getByRole('button', { name: '새 실험' }).first().click();
  await page.getByLabel('제목').fill('Offline field');
  await page.getByLabel('수집한 코드').fill(fixture('glsl/success.glsl'));
  await page.getByRole('button', { name: '작업본 만들기' }).click();
  await page.getByRole('button', { name: 'ARCHIVE' }).click();
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
    await page.getByRole('button', { name: '새 실험' }).first().click();
    await page.getByLabel('제목').fill(`${profile.name} fixture`);
    await page.getByLabel('수집한 코드').fill(fixture(profile.path));
    await expect(page.getByRole('heading', { name: profile.suggested })).toBeVisible();
    await page.getByRole('button', { name: '작업본 만들기' }).click();
    await page.getByRole('button', { name: '실행' }).click();

    await expect(page.frameLocator('iframe[title="Creative code preview"]').locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('RUNNING', { exact: true })).toBeVisible();
  });
}

test('keeps the runner away from network, popups, host navigation, and browser storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 실험' }).first().click();
  await page.getByLabel('수집한 코드').fill(fixture('three/success.js'));
  await page.getByRole('button', { name: '작업본 만들기' }).click();
  await page.getByLabel('로컬 에셋 추가').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.getByText('pixel.png')).toBeVisible();
  await page.getByRole('button', { name: '실행' }).click();
  await expect(page.frameLocator('iframe[title="Creative code preview"]').locator('canvas')).toBeVisible();
  const runnerBody = page.frameLocator('iframe[title="Creative code preview"]').locator('body');
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
  await page.getByRole('button', { name: '새 실험' }).first().click();
  await page.getByLabel('수집한 코드').fill(fixture('three/missing-asset.js'));
  await page.getByRole('button', { name: '작업본 만들기' }).click();
  await page.getByRole('button', { name: '실행' }).click();

  const error = page.getByRole('alert');
  await expect(error).toContainText('ASSET');
  await expect(error).toContainText('missing-texture.png');
});
