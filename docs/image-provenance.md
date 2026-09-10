# Menu Image Provenance

Generated for Cleo's Munchies on 2026-09-10 using the standard OpenAI GPT Image 2 capability (`gpt-image-2-medium` via `image_generate`). Higgsfield was not used.

The menu uses one representative image per dish. The 61 generated sources were center-cropped and optimized to 900×900 WebP at quality 82 with FFmpeg.

These are illustrative menu photographs, not photographs of the business's exact portions or a guarantee of delivered appearance. They contain no intended text, logos, staff, customers, or third-party branding.

## Visual direction

Premium Nigerian/Afro-fusion takeaway photography with warm directional light, deep charcoal surfaces, restrained pepper-red accents, realistic handmade texture, and square mobile-card-safe composition. Olive green belongs to the interface styling, not as a food garnish or ingredient unless the named dish calls for it.

Food identity takes priority over visual uniformity. Named proteins, fillings, accompaniments, soup styles, fish forms, and rice preparations must be distinguishable at menu-card size.

## Production assets

- 61 per-dish files under `public/images/menu/`
- Deterministic URL contract: `/images/menu/<dish-id>.webp`
- Machine-readable file sizes and SHA-256 checksums: `docs/menu-image-manifest.json`
- Machine-readable ingredient audit and okra policy: `docs/menu-image-ingredient-audit.json`
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

The initial fidelity pass corrected Choco Puff, Sugar Puff, Okra Soup, and Fish Shawarma. A subsequent owner review found inappropriate okra garnish in 25 non-okra dishes. Those 25 source images were surgically edited with the same standard GPT Image 2 tool and reinspected at source and card size. Seafood Okra and Okra Soup are the only assets permitted to show okra and were preserved byte-for-byte. The final set passed the rendered review.
