import { test, expect } from '@playwright/test';

const MONZO_URL = 'https://monzo.me/cleopatraejiogu?h=EltkP8&account_type=personal';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('mobile menu search, quick add, and cart persistence', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Explore the full menu' })).toBeVisible();
  await expect(page.locator('.food-card')).toHaveCount(61);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');

  await page.getByLabel('Search the menu').fill('Grilled Chicken');
  await expect(page.locator('.food-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Add Grilled Chicken', exact: true }).click();
  await expect(page.getByRole('button', { name: /View basket/ })).toContainText('£25.00');

  await page.reload();
  await expect(page.getByRole('button', { name: /View basket/ })).toContainText('£25.00');
});

test('tray variant sheet adds the selected size', async ({ page }) => {
  await page.getByRole('button', { name: 'Rice Trays', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a size for Jollof Rice' }).click();
  const dialog = page.getByRole('dialog', { name: 'Jollof Rice' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Half tray/ }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await expect(page.getByRole('dialog', { name: 'The basket' })).toContainText('Half tray');
  await expect(page.getByRole('dialog', { name: 'The basket' })).toContainText('£80.00');
});

test('option dialog locks background scrolling and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Rice Trays', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a size for Jollof Rice' }).click();

  await expect(page.getByRole('dialog', { name: 'Jollof Rice' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Jollof Rice' })).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('delivery validation and review-only Monzo handoff', async ({ page }) => {
  await page.getByLabel('Search the menu').fill('Grilled Chicken');
  await page.getByRole('button', { name: 'Add Grilled Chicken', exact: true }).click();
  await page.getByRole('button', { name: /View basket/ }).click();
  await page.getByRole('button', { name: /Continue to details/ }).click();

  await page.getByRole('button', { name: /Review order/ }).click();
  await expect(page.getByText('Please enter your name.')).toBeVisible();
  await expect(page.getByText('Please enter your phone number.')).toBeVisible();
  await expect(page.getByLabel('Name')).toBeFocused();

  await page.getByLabel('Name').fill('Ada Ejiogu');
  await page.getByLabel('Phone').fill('07939 427752');
  await page.getByLabel('Email (optional)').fill('ada@example.com');
  await page.getByLabel('Address').fill('10 Market Road');
  await page.getByLabel('Town or city').fill('Chichester');
  await page.getByLabel('Postcode').fill('PO19 1AA');
  await page.getByLabel('Preferred delivery date').fill('2026-09-18');
  await page.getByRole('button', { name: /Review order/ }).click();

  await expect(page.getByText('Review mode')).toBeVisible();
  await expect(page.getByText(/No order email has been sent/)).toBeVisible();
  await expect(page.getByText(/Do not send payment during review/)).toBeVisible();
  const reference = await page.locator('.review > h1').textContent();
  expect(reference).toMatch(/^CLEO-\d{6}-[0-9A-F]{6}$/);

  const handoff = page.getByRole('link', { name: /Continue to Monzo/ });
  await expect(handoff).toHaveAttribute('href', MONZO_URL);
  await expect(handoff).toHaveAttribute('target', '_blank');
  await expect(handoff).toHaveAttribute('aria-disabled', 'true');
  await expect(handoff).toContainText('locked in review');

  await page.getByRole('button', { name: /Edit details/ }).click();
  await page.getByRole('button', { name: /Review order/ }).click();
  await expect(page.locator('.review > h1')).toHaveText(reference);
});
