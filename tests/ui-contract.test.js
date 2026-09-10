import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  try {
    return await readFile(new URL(path, import.meta.url), 'utf8');
  } catch {
    return '';
  }
}

describe('mobile ordering UI contract', () => {
  it('renders the menu as the primary page experience', async () => {
    const app = await source('../src/App.jsx');
    assert.match(app, /Explore the full menu/);
    assert.match(app, /aria-label="Menu categories"/);
    assert.match(app, /Search the menu/);
  });

  it('exposes accessible cart and item-option surfaces', async () => {
    const app = await source('../src/App.jsx');
    assert.match(app, /role="dialog"/);
    assert.match(app, /aria-modal="true"/);
    assert.match(app, /aria-live="polite"/);
    assert.match(app, /View basket/);
  });

  it('keeps review mode truthful while Brevo is deferred', async () => {
    const app = await source('../src/App.jsx');
    assert.match(app, /Review mode/);
    assert.match(app, /No order email has been sent/);
    assert.match(app, /Do not send payment during review/);
    assert.match(app, /Food subtotal/);
    assert.match(app, /aria-disabled="true"/);
    assert.match(app, /preventDefault/);
    assert.doesNotMatch(app, /Payment confirmed/);
    assert.doesNotMatch(app, /48HR|48 hours/i);
  });

  it('uses self-contained typography and deterministic icons', async () => {
    const app = await source('../src/App.jsx');
    const css = await source('../src/styles.css');
    assert.doesNotMatch(css, /@import|fonts\.googleapis/);
    assert.doesNotMatch(app, /↗/);
  });

  it('labels quick-add and basket controls for assistive technology', async () => {
    const app = await source('../src/App.jsx');
    assert.match(app, /aria-label={`Add \${item\.name}`}/);
    assert.match(app, /aria-label="Close basket"/);
    assert.match(app, /inputMode={name === 'phone' \? 'tel'/);
  });

  it('contains the exact approved Monzo handoff with safe new-tab behavior', async () => {
    const app = await source('../src/App.jsx');
    assert.match(app, /MONZO_PAYMENT_URL/);
    assert.match(app, /target="_blank"/);
    assert.match(app, /rel="noreferrer"/);
    assert.match(app, /Continue to Monzo/);
  });

  it('includes mobile safe-area and reduced-motion protections', async () => {
    const css = await source('../src/styles.css');
    assert.match(css, /\.categories\{[^}]*position:sticky[^}]*top:76px/);
    assert.match(css, /\.categories::-webkit-scrollbar\{display:none\}/);
    assert.match(css, /\.quantity button\{[^}]*width:44px[^}]*height:44px/);
    assert.match(css, /\.close\{[^}]*min-width:44px/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /min-height:\s*44px/);
  });
});
