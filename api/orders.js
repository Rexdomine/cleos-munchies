import { findMenuItem } from '../src/data/menu.js';

const OPERATOR_EMAIL = 'cleopatraejiogu@gmail.com';
const SENDER_EMAIL = 'yummy@cleosmunchies.co.uk';
const SENDER_NAME = "Cleo's Munchies";
const LOGO_URL = 'https://cleos-munchies.vercel.app/images/cleos-logo.png?v=2';
const MONZO_PAYMENT_URL = 'https://monzo.me/cleopatraejiogu?h=EltkP8&account_type=personal';
const MAX_ITEMS = 100;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pounds(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

function getCanonicalLines(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) return null;
  const lines = [];
  for (const item of items) {
    const source = findMenuItem(clean(item?.id, 100));
    const quantity = Number(item?.quantity);
    if (!source || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
    let price = source.price;
    let variantLabel = '';
    if (source.variants) {
      const variant = source.variants.find((entry) => entry.id === clean(item?.variantId, 50));
      if (!variant) return null;
      price = variant.price;
      variantLabel = variant.label;
    }
    lines.push({ name: source.name, quantity, price, variantLabel });
  }
  return lines;
}

function itemRows(lines) {
  return lines.map((line) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e5dbcf;color:#1d1b18;font-size:15px;line-height:1.4"><strong>${line.quantity} × ${escapeHtml(line.name)}</strong>${line.variantLabel ? `<br><span style="color:#766e65;font-size:13px">${escapeHtml(line.variantLabel)}</span>` : ''}</td><td align="right" style="padding:14px 0;border-bottom:1px solid #e5dbcf;color:#1d1b18;font-size:15px;white-space:nowrap">${pounds(line.price * line.quantity)}</td></tr>`).join('');
}

function textItems(lines) {
  return lines.map((line) => `${line.quantity} x ${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ''} — ${pounds(line.price * line.quantity)}`).join('\n');
}

function detailsRows(details) {
  return `<tr><td style="padding:5px 0;color:#766e65;font-size:13px">Name</td><td align="right" style="padding:5px 0;color:#1d1b18;font-size:13px">${escapeHtml(details.name)}</td></tr><tr><td style="padding:5px 0;color:#766e65;font-size:13px">Phone</td><td align="right" style="padding:5px 0;color:#1d1b18;font-size:13px">${escapeHtml(details.phone)}</td></tr><tr><td style="padding:5px 0;color:#766e65;font-size:13px">Email</td><td align="right" style="padding:5px 0;color:#1d1b18;font-size:13px">${escapeHtml(details.email)}</td></tr><tr><td style="padding:5px 0;color:#766e65;font-size:13px;vertical-align:top">Address</td><td align="right" style="padding:5px 0;color:#1d1b18;font-size:13px;line-height:1.45">${escapeHtml(details.address)}<br>${escapeHtml(details.city)}<br>${escapeHtml(details.postcode)}</td></tr>${details.notes ? `<tr><td style="padding:5px 0;color:#766e65;font-size:13px;vertical-align:top">Notes</td><td align="right" style="padding:5px 0;color:#1d1b18;font-size:13px;line-height:1.45">${escapeHtml(details.notes)}</td></tr>` : ''}`;
}

function emailShell({ preheader, eyebrow, title, intro, reference, content, footer }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background:#eee8df;color:#1d1b18;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eee8df"><tr><td align="center" style="padding:28px 12px 42px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#f7f1e8;border:1px solid #ded3c6;border-radius:18px;overflow:hidden"><tr><td style="padding:26px 30px 22px;border-bottom:1px solid #ded3c6"><img src="${LOGO_URL}" width="256" alt="Cleo's Munchies" style="display:block;width:256px;max-width:100%;height:auto;border:0"></td></tr><tr><td style="padding:34px 30px 12px"><p style="margin:0 0 12px;color:#bd392e;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">${escapeHtml(eyebrow)}</p><h1 style="margin:0;color:#1d1b18;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.08;font-weight:normal;letter-spacing:-.5px">${escapeHtml(title)}</h1><p style="margin:16px 0 0;color:#5f574e;font-size:16px;line-height:1.6">${intro}</p>${reference ? `<p style="display:inline-block;margin:22px 0 0;padding:9px 13px;background:#1d1b18;border-radius:999px;color:#f7f1e8;font-family:monospace;font-size:13px;letter-spacing:1px">${escapeHtml(reference)}</p>` : ''}</td></tr><tr><td style="padding:16px 30px 30px">${content}</td></tr><tr><td style="padding:22px 30px;background:#1d1b18;color:#f7f1e8"><p style="margin:0;color:#f7f1e8;font-size:13px;line-height:1.6">${footer}</p></td></tr></table><p style="max-width:620px;margin:16px auto 0;text-align:center;color:#82786d;font-size:11px;line-height:1.5">Cleo’s Munchies · Nigerian comfort, made for sharing</p></td></tr></table></body></html>`;
}

function orderCard(lines, total, details, showDetails = true) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fffaf4;border:1px solid #e5dbcf;border-radius:12px;padding:4px 18px 14px"><tr><td colspan="2" style="padding:14px 0 8px;color:#526548;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Your order</td></tr>${itemRows(lines)}<tr><td style="padding:18px 0 4px;color:#766e65;font-size:13px">Food subtotal</td><td align="right" style="padding:18px 0 4px;color:#1d1b18;font-size:19px;font-weight:bold">${pounds(total)}</td></tr></table>${showDetails ? `<div style="height:14px;line-height:14px">&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e8eee3;border-radius:12px;padding:12px 18px 14px"><tr><td colspan="2" style="padding:0 0 8px;color:#526548;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Delivery details</td></tr>${detailsRows(details)}</table>` : ''}`;
}

function paymentGuide(reference) {
  const safeReference = escapeHtml(reference);
  return `<div style="height:22px;line-height:22px">&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1d1b18;border-radius:12px"><tr><td style="padding:22px 20px;color:#f7f1e8"><p style="margin:0 0 7px;color:#f4b44d;font-size:11px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase">Important — payment step</p><h2 style="margin:0 0 9px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.15">Copy your code into Monzo</h2><p style="margin:0 0 17px;color:#f1e6d9;font-size:14px;line-height:1.55">Please follow these two steps carefully so we can match your payment quickly.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:12px 14px;background:#fffaf4;border:2px solid #bd392e;border-radius:8px"><p style="margin:0 0 6px;color:#bd392e;font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">1 · Copy this order code</p><p style="margin:0;color:#1d1b18;font-family:Consolas,'Courier New',monospace;font-size:21px;font-weight:bold;letter-spacing:1px;word-break:break-all;user-select:all">${safeReference}</p><p style="margin:7px 0 0;color:#766e65;font-size:11px;line-height:1.4">Press and hold the code to select and copy it.</p></td></tr><tr><td style="padding:13px 0 0"><p style="margin:0;color:#f7f1e8;font-size:14px;line-height:1.5"><strong style="color:#f4b44d">2 · Paste it into Monzo payment Notes</strong><br>Use the exact code above — it is how we identify your order.</p></td></tr></table><div style="height:18px;line-height:18px">&nbsp;</div><a href="${MONZO_PAYMENT_URL}" style="display:inline-block;padding:14px 20px;background:#bd392e;border-radius:7px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Open Monzo securely&nbsp; →</a><p style="margin:12px 0 0;color:#d8cbbd;font-size:12px;line-height:1.5">Payment is not confirmed until we manually match the Monzo payment to this reference.</p></td></tr></table>`;
}

function customerText(details, lines, total, reference) {
  return `Cleo's Munchies preorder ${reference}\n\nThanks for your order, ${details.name}.\n\n${textItems(lines)}\n\nFood subtotal: ${pounds(total)}\n\nIMPORTANT PAYMENT STEP:\n1. COPY this exact order code: ${reference}\n2. PASTE it into Monzo payment Notes.\nUse the exact code so we can match your payment quickly.\n\nOpen Monzo: ${MONZO_PAYMENT_URL}\nPayment is not confirmed until we manually match it. Your food will be ready within 48 hours. Delivery arrangements and any delivery charge will be confirmed separately.`;
}

function operatorText(details, lines, total, reference) {
  return `New Cleo's Munchies preorder ${reference}\n\n${textItems(lines)}\n\nFood subtotal: ${pounds(total)}\n\nCustomer: ${details.name}\nPhone: ${details.phone}\nEmail: ${details.email}\nAddress: ${details.address}, ${details.city}, ${details.postcode}${details.notes ? `\nNotes: ${details.notes}` : ''}\n\nPreorder standard: ready within 48 hours. Payment remains subject to manual Monzo reconciliation.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return json(res, 503, { error: 'Order notifications are temporarily unavailable.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const reference = clean(body.reference, 40);
  const idempotencyKey = clean(body.idempotencyKey, 100);
  const details = body.customer && typeof body.customer === 'object' ? {
    name: clean(body.customer.name, 120), phone: clean(body.customer.phone, 40), email: clean(body.customer.email, 254).toLowerCase(),
    address: clean(body.customer.address, 300), city: clean(body.customer.city, 120), postcode: clean(body.customer.postcode, 30), notes: clean(body.customer.notes, 500),
  } : null;
  const lines = getCanonicalLines(body.items);

  if (!/^CLEO-\d{6}-[0-9A-F]{6}$/.test(reference) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(idempotencyKey) || !details || !validEmail(details.email) || !details.name || !details.phone || !details.address || !details.city || !details.postcode || !lines) {
    return json(res, 400, { error: 'Please check the order details and try again.' });
  }

  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const customerHtml = { html: emailShell({ preheader: `Your Cleo’s Munchies preorder ${reference} is safely with us.`, eyebrow: 'Order received', title: `Thanks, ${details.name}`, intro: `We’ve received your preorder and sent the details to the Cleo’s Munchies kitchen team.`, reference, content: `${orderCard(lines, total, details)}${paymentGuide(reference)}`, footer: 'Questions? Reply to this email and the Cleo’s Munchies team will help.' }), textContent: customerText(details, lines, total, reference) };
  const operatorHtml = { html: emailShell({ preheader: `New preorder ${reference} needs kitchen and payment reconciliation.`, eyebrow: 'Kitchen notification', title: 'New preorder', intro: 'A new preorder has been submitted. Please confirm preparation and manually reconcile payment against the reference below.', reference, content: `${orderCard(lines, total, details)}<div style="height:18px;line-height:18px">&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:16px 18px;background:#e8eee3;border-left:4px solid #526548;border-radius:8px"><p style="margin:0;color:#405039;font-size:14px;line-height:1.55"><strong>Ready within 48 hours.</strong><br>Payment remains subject to manual Monzo reconciliation.</p></td></tr></table>`, footer: 'Cleo’s Munchies · Keep this reference attached to the kitchen and payment record.' }), textContent: operatorText(details, lines, total, reference) };

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ sender: { email: SENDER_EMAIL, name: SENDER_NAME }, subject: `Cleo’s Munchies preorder ${reference}`, htmlContent: operatorHtml.html, textContent: operatorHtml.textContent, headers: { idempotencyKey }, messageVersions: [
      { to: [{ email: OPERATOR_EMAIL, name: 'Cleopatra Ejiogu' }], subject: `New preorder ${reference}`, htmlContent: operatorHtml.html, textContent: operatorHtml.textContent },
      { to: [{ email: details.email, name: details.name }], subject: `Your Cleo’s Munchies preorder ${reference}`, htmlContent: customerHtml.html, textContent: customerHtml.textContent },
    ] }),
  });

  if (!brevoResponse.ok) {
    let errorCode = 'provider_error';
    try { errorCode = (await brevoResponse.json()).code || errorCode; } catch {}
    console.error('Brevo order notification failed', { status: brevoResponse.status, code: errorCode });
    return json(res, brevoResponse.status === 429 ? 503 : 502, { error: 'We could not send the order notification. Please try again.' });
  }

  const result = await brevoResponse.json();
  return json(res, 200, { status: 'submitted', reference, messageIds: result.messageIds || [result.messageId].filter(Boolean) });
}
