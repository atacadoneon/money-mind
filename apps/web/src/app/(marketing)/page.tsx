/**
 * NOTE: This file intentionally does NOT export a default component to avoid
 * conflicting with app/page.tsx. The marketing landing page lives at /landing.
 * See: src/app/(marketing)/landing/page.tsx
 *
 * Next.js requires that only one page.tsx file resolves to each URL.
 * Since app/page.tsx already handles /, this file must not export default.
 *
 * TypeScript will show an error if Next.js tries to treat this as a page.
 * If Next.js build errors on duplicate route, simply remove this file.
 */
export const MARKETING_HOME_AT = "/landing";
