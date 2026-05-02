# CLO-582 Landing con QR - Design Spec

## Goal
Build a minimal, dark-mode, mobile-first landing page at `/` for LinearVoice, aligned with ticket `CLO-582`.

## Scope
- Allowed:
  - `app/page.tsx`
  - `components/landing/**`
  - `components/ui/**` (only if needed)
  - `app/globals.css` (only if needed)
- Out of scope:
  - `app/api/**`
  - `lib/**`
  - `app/dashboard/**`
  - `.env*`, `next.config.*`, `tsconfig.json`

## UI Structure (Option A - Composable Landing)
The landing is split into focused components under `components/landing/` and composed by `app/page.tsx`.

1. `LandingHero`
   - Title: `LinearVoice`
   - Tagline: `habla por WhatsApp, planea con Linear`
   - Short supporting text

2. `LandingQrCard`
   - QR placeholder visual (local static placeholder)
   - Fixed placeholder WhatsApp number
   - Primary CTA button to `https://wa.me/0000000000`
   - Secondary CTA link to `/dashboard`

3. `LandingFeatures`
   - Max 3 bullets:
     - Voz
     - Multi-idioma
     - Multi-modelo via AI Gateway

## Visual & Styling
- Dark palette baseline (`zinc/slate` tones)
- Emerald accent (`emerald-500`) for primary CTA and highlights
- Mobile-first spacing and typography
- Desktop as enhancement via responsive grid/spacing
- Subtle motion using existing `tw-animate-css` classes (entry + hover only)

## Accessibility
- Semantically correct headings and list structure
- Sufficient color contrast on dark background
- Descriptive CTA labels and link targets
- No decorative animation that impacts readability

## Implementation Notes
- Keep `app/page.tsx` thin: layout container + section composition.
- Do not add backend logic or API coupling.
- Use existing shadcn primitives where appropriate (button, card-like styles).
- Keep the WhatsApp number hardcoded placeholder as requested.

## Verification Plan
1. Run `pnpm typecheck`
2. Run `pnpm build`
3. Quick manual check:
   - Mobile layout readability
   - Hero + QR + both CTAs present
   - `/dashboard` link resolves
   - No browser console errors
