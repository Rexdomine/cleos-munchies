import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`${viewport.name} layout has decoded media, no overflow, and clean runtime`, async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Explore the full menu' })).toBeVisible();
    await page.locator('img').first().evaluate(async image => image.decode());
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      brokenImages: [...document.images]
        .filter(image => image.complete && image.naturalWidth === 0)
        .map(image => image.getAttribute('src')),
    }));

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.brokenImages).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    const heroGeometry = await page.evaluate(() => {
      const copy = document.querySelector('.hero .lede').getBoundingClientRect();
      const image = document.querySelector('.hero-art').getBoundingClientRect();
      const overlaps = !(
        copy.right <= image.left ||
        copy.bottom <= image.top ||
        copy.left >= image.right ||
        copy.top >= image.bottom
      );
      return {
        overlaps,
        copy: { left: copy.left, right: copy.right, top: copy.top, bottom: copy.bottom },
        image: { left: image.left, right: image.right, top: image.top, bottom: image.bottom },
      };
    });
    expect(heroGeometry.overlaps, JSON.stringify(heroGeometry)).toBe(false);

    await mkdir('/tmp/cleos-qa', { recursive: true });
    await page.screenshot({ path: `/tmp/cleos-qa/${viewport.name}-home.png` });

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const categories = document.querySelector('.categories');
      const documentTop = categories.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, documentTop + 240);
    });
    const geometry = await page.evaluate(() => {
      const header = document.querySelector('.topbar').getBoundingClientRect();
      const categories = document.querySelector('.categories').getBoundingClientRect();
      return {
        headerBottom: Math.round(header.bottom),
        categoriesTop: Math.round(categories.top),
      };
    });
    expect(geometry.categoriesTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
    expect(geometry.categoriesTop).toBeLessThanOrEqual(geometry.headerBottom + 1);
    await page.screenshot({ path: `/tmp/cleos-qa/${viewport.name}-menu.png` });
  });
}

test('all 61 dish-specific menu images load and decode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const images = page.locator('.food-card img');
  await expect(images).toHaveCount(61);

  const sources = new Set();
  for (let index = 0; index < 61; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    sources.add(await image.getAttribute('src'));
  }
  expect(sources.size).toBe(61);
});

test('mobile basket, checkout, and review states remain within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByLabel('Search the menu').fill('Grilled Chicken');
  await page.getByRole('button', { name: 'Add Grilled Chicken', exact: true }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page.getByRole('dialog', { name: 'The basket' })).toBeVisible();
  await page.screenshot({ path: '/tmp/cleos-qa/mobile-basket.png' });

  await page.getByRole('button', { name: /Continue to details/ }).click();
  await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible();
  await page.screenshot({ path: '/tmp/cleos-qa/mobile-checkout.png', fullPage: true });

  await page.getByLabel('Name').fill('Ada Ejiogu');
  await page.getByLabel('Phone').fill('07939 427752');
  await page.getByLabel('Address').fill('10 Market Road');
  await page.getByLabel('Town or city').fill('Chichester');
  await page.getByLabel('Postcode').fill('PO19 1AA');
  await page.getByLabel('Preferred delivery date').fill('2026-09-18');
  await page.getByRole('button', { name: /Review order/ }).click();
  await expect(page.getByText('Review mode')).toBeVisible();
  await expect(page.getByRole('link', { name: /Continue to Monzo/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: '/tmp/cleos-qa/mobile-review.png', fullPage: true });
});
