import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { getAdminEmail, resetCertCache, verifyAccessJwt } from '../worker/src/auth.js';

const TEAM = 'https://cleos.cloudflareaccess.com';
const AUD = 'test-audience-tag';

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function makeSigner(kid = 'key-1') {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid };
  const sign = async (payload, { kid: tokenKid = kid } = {}) => {
    const header = b64url(JSON.stringify({ alg: 'RS256', kid: tokenKid, typ: 'JWT' }));
    const body = b64url(JSON.stringify(payload));
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${header}.${body}`));
    return `${header}.${body}.${b64url(new Uint8Array(signature))}`;
  };
  const fetchImpl = async (url) => {
    assert.equal(url, `${TEAM}/cdn-cgi/access/certs`);
    return { ok: true, async json() { return { keys: [jwk] }; } };
  };
  return { sign, fetchImpl };
}

const now = () => Math.floor(Date.now() / 1000);
const claims = (overrides = {}) => ({ aud: [AUD], iss: TEAM, email: 'Cleo@Example.com', exp: now() + 600, nbf: now() - 10, ...overrides });
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: 'cleo@example.com, owner@example.com' };
const request = (token) => new Request('https://api.example/api/admin/session', { headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} });

describe('Cloudflare Access key rotation', () => {
  beforeEach(() => resetCertCache());

  it('refetches signing keys when a token uses a new key, at most once a minute', async () => {
    const oldSigner = await makeSigner('old-key');
    const newSigner = await makeSigner('new-key');
    let served = oldSigner;
    let fetches = 0;
    const fetchImpl = async (url) => {
      fetches += 1;
      return served.fetchImpl(url);
    };
    const verify = (token) => verifyAccessJwt(token, { teamDomain: TEAM, audience: AUD, fetchImpl });

    const realNow = Date.now();
    const clock = mock.method(Date, 'now', () => realNow);
    try {
      await verify(await oldSigner.sign(claims()));
      assert.equal(fetches, 1);

      // Cloudflare rotates keys. Within a minute of the last fetch, an unknown key is rejected without refetching.
      served = newSigner;
      const newToken = await newSigner.sign(claims());
      await assert.rejects(verify(newToken), /Unknown signing key/);
      assert.equal(fetches, 1);

      // After a minute, the unknown key triggers one refetch and the token is accepted.
      clock.mock.mockImplementation(() => realNow + 2 * 60 * 1000);
      assert.equal((await verify(newToken)).email, 'Cleo@Example.com');
      assert.equal(fetches, 2);
      await verify(newToken);
      assert.equal(fetches, 2);
    } finally {
      clock.mock.restore();
    }
  });
});

describe('Cloudflare Access admin auth', () => {
  beforeEach(() => resetCertCache());

  it('accepts a valid token for a listed admin', async () => {
    const { sign, fetchImpl } = await makeSigner();
    const payload = await verifyAccessJwt(await sign(claims()), { teamDomain: TEAM, audience: AUD, fetchImpl });
    assert.equal(payload.email, 'Cleo@Example.com');
    assert.equal(await getAdminEmail(request(await sign(claims())), env, fetchImpl), 'cleo@example.com');
  });

  it('rejects wrong audience, issuer, expiry, key and tampering', async () => {
    const { sign, fetchImpl } = await makeSigner();
    const verify = (token) => verifyAccessJwt(token, { teamDomain: TEAM, audience: AUD, fetchImpl });
    await assert.rejects(verify(await sign(claims({ aud: ['other'] }))), /audience/);
    await assert.rejects(verify(await sign(claims({ iss: 'https://evil.cloudflareaccess.com' }))), /issuer/);
    await assert.rejects(verify(await sign(claims({ exp: now() - 1 }))), /expired/);
    await assert.rejects(verify(await sign(claims(), { kid: 'other' })), /Unknown signing key/);
    const [header, , signature] = (await sign(claims())).split('.');
    const forged = b64url(JSON.stringify(claims({ email: 'owner@example.com' })));
    await assert.rejects(verify(`${header}.${forged}.${signature}`), /signature/);
    await assert.rejects(verify('not-a-token'), /Malformed/);
  });

  it('refuses people who are not on the admin list, or have no token', async () => {
    const { sign, fetchImpl } = await makeSigner();
    assert.equal(await getAdminEmail(request(await sign(claims({ email: 'stranger@example.com' }))), env, fetchImpl), null);
    assert.equal(await getAdminEmail(request(), env, fetchImpl), null);
    assert.equal(await getAdminEmail(request(await sign(claims())), { ...env, ACCESS_AUD: '' }, fetchImpl), null);
  });

  it('only allows the local dev sign-in when Access is not configured', async () => {
    const { sign, fetchImpl } = await makeSigner();
    const devEnv = { ADMIN_EMAILS: 'cleo@example.com', DEV_ADMIN_EMAIL: 'cleo@example.com' };
    assert.equal(await getAdminEmail(request(), devEnv, fetchImpl), 'cleo@example.com');
    assert.equal(await getAdminEmail(request(), { ...devEnv, DEV_ADMIN_EMAIL: 'stranger@example.com' }, fetchImpl), null);
    // With Access configured, the dev email is ignored and a real token is required.
    assert.equal(await getAdminEmail(request(), { ...env, DEV_ADMIN_EMAIL: 'cleo@example.com' }, fetchImpl), null);
    assert.equal(await getAdminEmail(request(await sign(claims())), { ...env, DEV_ADMIN_EMAIL: 'stranger@example.com' }, fetchImpl), 'cleo@example.com');
  });
});
