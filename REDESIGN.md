# Seoul Glow — Editorial Redesign ("Seoul Editorial Concept Store")

Quiet luxury × Korean editorial × architectural minimalism.
Palette: #F5F3EE off-white · #EAE6DF ivory · #20201E charcoal · #B7B0A5 stone · #9A8F83 taupe · accent celadon #5F7466.
Type: Inter Tight (300–500, tracked uppercase labels) · Instrument Serif italic accents · IBM Plex Sans Arabic.

## How it is built (isolated, reversible)
- `assets/editorial.css` — the entire design layer. Loaded only when **Theme settings › Editorial design › Enable** is on; every rule is scoped to `body.ed` or `.ed-*`.
  **Turning the checkbox off restores the previous look instantly.**
- New sections (all bilingual EN/AR, OS 2.0 schemas, usable on any template):
  `ed-hero` (separate desktop/mobile images) · `ed-dual` (01 Fashion Edit / 02 Beauty Edit) · `ed-grid` (collection grid: New Arrivals / Best Sellers) · `ed-campaign` (asymmetric campaign + shop-the-look) · `ed-story` (brand statement + 3 principles).
- New snippets: `ed-details` (PDP metafield details), `ed-swatches` (real Color option only), `ed-em` (`*word*` → serif italic).
- Homepage order: Hero → Two edits → New Arrivals → Fashion campaign → Best Sellers → Beauty campaign → Story → Trust bar.
  Previous homepage saved at `backups/index.classic-2026-11-06.json`. Old sections (quiz, night drop, map, booth…) stay available in the editor.
- Header: new menus `editorial-menu` / `editorial-menu-ar` (NEW ARRIVALS · FASHION · BEAUTY · BEST SELLERS · ABOUT). Transparent over hero → solid on scroll (existing logic kept).
- Footer: legal links pulled from the store's real policies; payment icons from enabled payment types; socials from settings.
- Product page: new block **Product details (metafields)**. Shows only values that exist — nothing invented.
  - Beauty: Shopify taxonomy fields (active ingredient, skin-care effect, skin type) + `custom.benefits`, `custom.volume`, `custom.how_to_use`, `custom.ingredients_inci`, `custom.safety`, `custom.routine` (complete-the-routine products).
  - Fashion (tag `kavo`): `custom.material`, `custom.fit`, `custom.model_info`, `custom.care`.
  - Definitions were created in Settings › Custom data › Products — fill them per product.
- Cart, search, currency, language switch, quick add, sticky ATC, apps blocks: untouched.

## QA done
- Theme Check: no errors (only the existing Google Fonts RemoteAsset warnings).
- Rendered EN + AR at 320 / 390 / 768 / 1440 px: no horizontal overflow; RTL mirrors correctly.
- `prefers-reduced-motion` disables the hero zoom and hover motion.

## Install / preview
Upload the theme to an unpublished slot → Customize → preview → publish only after approval.

## Rollback
1. Quick: Theme settings › Editorial design › untick.
2. Full: republish the previous theme, or restore git tag `live-maison-2026-11-06` / `backups/live-maison-2026-11-06.zip`.

## Known limits
- Campaign images reuse existing store imagery (image generation credits ran out). Swap in new shots via each section's image pickers.
- Most beauty products have no metafield values yet, so the details block stays hidden on them until filled.
