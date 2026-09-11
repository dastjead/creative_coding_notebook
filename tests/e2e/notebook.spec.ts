import { expect, test } from '@playwright/test';

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
