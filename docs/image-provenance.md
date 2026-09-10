# Menu Image Provenance

Generated for Cleo's Munchies on 2026-09-10 using the standard OpenAI GPT Image 2 capability (`gpt-image-2-medium` via `image_generate`). Higgsfield was not used.

The menu uses one representative image per dish. The 61 generated sources were center-cropped and optimized to 900×900 WebP at quality 82 with FFmpeg.

These are illustrative menu photographs, not photographs of the business's exact portions or a guarantee of delivered appearance. They contain no intended text, logos, staff, customers, or third-party branding.

## Visual direction

Premium Nigerian/Afro-fusion takeaway photography with warm directional light, deep charcoal surfaces, restrained pepper-red and okra-green brand accents, realistic handmade texture, and square mobile-card-safe composition.

Food identity takes priority over visual uniformity. Named proteins, fillings, accompaniments, soup styles, fish forms, and rice preparations must be distinguishable at menu-card size.

## Production assets

- 61 per-dish files under `public/images/menu/`
- Deterministic URL contract: `/images/menu/<dish-id>.webp`
- Machine-readable file sizes and SHA-256 checksums: `docs/menu-image-manifest.json`
- Generation sources remain uncommitted under `.hermes/dish-images-batch-a/` and `.hermes/dish-images-batch-b/`
- Fidelity criteria: `docs/menu-image-fidelity.md`

## Visual QA

All exact production WebPs were loaded and decoded in Chromium. Ten category scenarios verified 61 unique item URLs and captured the rendered photograph beside its dish name at a 390×844 mobile viewport.

A dish-by-dish visual review checked:

- exact named dish and protein/filling/accompaniment alignment;
- distinct soup and rice preparations;
- fish and grill identity;
- no malformed food, accidental text, watermark, logo, or person;
- no repeated menu image URLs.

Targeted regeneration corrected Choco Puff, Sugar Puff, Okra Soup, and Fish Shawarma. Fish Shawarma received a second refinement so flaky skin-on fish remains unmistakable at menu-card size. The final set passed the rendered review.
