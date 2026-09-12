import { test, expect } from '@playwright/test';

const MONZO_URL = 'https://monzo.me/cleopatraejiogu?h=EltkP8&account_type=personal';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/orders', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'submitted', messageIds: ['test-operator', 'test-customer'] }) }));
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
  await page.getByLabel('Email').fill('ada@example.com');
  await page.locator('input[name="address"]').fill('10 Market Road');
  await page.getByLabel('Town or city').fill('Chichester');
  await page.getByLabel('Postcode').fill('PO19 1AA');
  await expect(page.getByText(/preorder standard.*within 48 hours/i)).toBeVisible();
  await page.getByRole('button', { name: /Review order/ }).click();

  await expect(page.getByText('Order submitted')).toBeVisible();
  await expect(page.getByText(/Order notification sent to you and Cleo’s Munchies/)).toBeVisible();
  await expect(page.getByText(/Payment is not confirmed until Monzo payment is manually matched/)).toBeVisible();
  const reference = await page.locator('.review > h1').textContent();
  expect(reference).toMatch(/^CLEO-\d{6}-[0-9A-F]{6}$/);

  const handoff = page.getByRole('link', { name: /Continue to Monzo/ });
  await expect(handoff).toHaveAttribute('href', MONZO_URL);
  await expect(handoff).toHaveAttribute('target', '_blank');
  await expect(handoff).not.toHaveAttribute('aria-disabled', 'true');
  await expect(handoff).toContainText('Continue to Monzo');

  await page.getByRole('button', { name: /Edit details/ }).click();
  await page.getByRole('button', { name: /Review order/ }).click();
  await expect(page.locator('.review > h1')).toHaveText(reference);
});
