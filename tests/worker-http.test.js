import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readJson } from '../worker/src/http.js';

function streamedRequest(chunks) {
  // No Content-Length: the body arrives as a stream.
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Request('https://api.example/api/orders', { method: 'POST', body, duplex: 'half' });
}

describe('Request body reading', () => {
  it('parses small JSON bodies', async () => {
    assert.deepEqual(await readJson(streamedRequest(['{"a":', '1}'])), { body: { a: 1 } });
    assert.deepEqual(await readJson(streamedRequest(['not json'])), { error: 'invalid_json' });
  });

  it('stops reading once the stream passes 32 KB, counting bytes not characters', async () => {
    const big = Array.from({ length: 10 }, () => 'x'.repeat(4096));
    assert.deepEqual(await readJson(streamedRequest(big)), { error: 'too_large' });
    // 12,000 three-byte characters is 36 KB of UTF-8 even though it is only 12,000 characters.
    assert.deepEqual(await readJson(streamedRequest([JSON.stringify({ note: '€'.repeat(12000) })])), { error: 'too_large' });
  });
});
