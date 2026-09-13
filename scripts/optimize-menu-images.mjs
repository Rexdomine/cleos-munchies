import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MENU } from '../src/data/menu.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPaths = [
  resolve(projectRoot, '.hermes/dish-images-batch-a/manifest.json'),
  resolve(projectRoot, '.hermes/dish-images-batch-b/manifest.json'),
];
const outputDir = resolve(projectRoot, 'public/images/menu');
const provenancePath = resolve(projectRoot, 'docs/menu-image-manifest.json');

for (const manifestPath of manifestPaths) {
  if (!existsSync(manifestPath)) throw new Error(`Missing generation manifest: ${manifestPath}`);
}

const generated = manifestPaths.flatMap((manifestPath) => {
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.items;
});
const byId = new Map();
for (const entry of generated) {
  if (!entry?.id || !entry?.output) throw new Error('Every manifest entry needs id and output fields.');
  if (byId.has(entry.id)) throw new Error(`Duplicate generated image id: ${entry.id}`);
  if (!existsSync(entry.output) || statSync(entry.output).size === 0) {
    throw new Error(`Missing or empty generated source for ${entry.id}: ${entry.output}`);
  }
  byId.set(entry.id, entry);
}

const expectedIds = new Set(MENU.map((item) => item.id));
const unexpected = [...byId.keys()].filter((id) => !expectedIds.has(id));
const missing = MENU.filter((item) => !byId.has(item.id)).map((item) => item.id);
if (unexpected.length || missing.length || byId.size !== MENU.length) {
  throw new Error(`Manifest mismatch. Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}.`);
}

mkdirSync(outputDir, { recursive: true });
const provenance = [];
for (const item of MENU) {
  const source = byId.get(item.id);
  const output = resolve(outputDir, `${item.id}.webp`);
  const temporary = `${output}.tmp.webp`;
  const result = spawnSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-i', source.output,
    '-vf', 'scale=480:480:force_original_aspect_ratio=increase,crop=480:480',
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '74', temporary,
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`FFmpeg failed for ${item.id}: ${result.stderr}`);
  renameSync(temporary, output);
  const bytes = readFileSync(output);
  provenance.push({
    id: item.id,
    name: item.name,
    category: item.category,
    file: `public/images/menu/${item.id}.webp`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    generator: 'OpenAI GPT Image 2 via image_generate',
    representative: true,
  });
}

writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify({ generated: generated.length, optimized: provenance.length, outputDir, provenancePath }, null, 2));
