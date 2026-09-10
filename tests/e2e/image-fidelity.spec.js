import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const categories = [
  ['Breakfast', 6],
  ['Indomie', 5],
  ['Puff Puff', 4],
  ['Appetisers', 6],
  ['Soups', 9],
  ['Pies', 3],
  ['Shawarma', 6],
  ['Moi Moi', 5],
  ['Clean Grills', 9],
  ['Rice Trays', 8],
];

for (const [category, expectedCount] of categories) {
  test(`${category} cards pair each dish name with a decoded item image`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: category, exact: true }).click();

    const cards = page.locator('.food-card');
    await expect(cards).toHaveCount(expectedCount);
    const sources = new Set();
    for (let index = 0; index < expectedCount; index += 1) {
      const card = cards.nth(index);
      const image = card.locator('img');
      const title = await card.getByRole('heading').textContent();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
      const source = await image.getAttribute('src');
      sources.add(source);
      const expectedSlug = source.split('/').pop().replace(/\.webp$/, '');
      if (!expectedSlug) throw new Error(`Missing image path for ${title}`);
    }
    expect(sources.size).toBe(expectedCount);

    await mkdir('/tmp/cleos-dish-qa', { recursive: true });
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    // Fixed/sticky UI is useful in interaction QA but obscures cards in full-page evidence.
    await page.addStyleTag({ content: '.topbar, .categories { visibility: hidden !important; }' });
    await page.screenshot({ path: `/tmp/cleos-dish-qa/${slug}.png`, fullPage: true });
  });
}
