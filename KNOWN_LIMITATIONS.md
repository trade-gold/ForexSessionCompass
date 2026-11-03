# Known Limitations, Architecture Notes & Buyer Pre-Launch Checklist

This document provides a transparent record of architecture choices and environment-specific steps for the new owner.

## 1. Verified in the Sandbox Build & Audit Environment

- **AST & TypeScript/JSX Compilation**: All **112 `.ts` and `.tsx` source and test files** parsed and compiled cleanly via `@babel/core` (`@babel/preset-typescript` + `@babel/preset-react`) with **0 syntax or binding errors**.
- **Automated Unit, Routing, SEO & Security Tests**: **66 / 66 tests** across 8 test suites (`forex-time.test.ts`, `plans.test.ts`, `trader-tools.test.ts`, `academy-access.test.ts`, `security-and-edge-cases.test.ts`, `security-headers.test.ts`, `repo-security.test.ts`, and `sitemap.test.ts`) executed and passed (`0 failed`).
- **Chronological SQL Migrations**: All 6 migrations in `supabase/migrations/` (`20261031101444_...` through `20261102120000_...`) are chronologically ordered and synchronized with `drizzle/migrations/`.

## 2. Operational Design Notes

1. **Manual / Off-Platform Payment Verification by Design**:
   - Customers can view pricing on `/pricing` (`Free $0`, `Pro $19/30d`, `Elite $49/30d`, `Academy & Tutor White-Label $99/30d` — all editable in `/admin`) and submit their payment reference (UPI, bank transfer, crypto, or invoice reference) via `public.submit_payment()`.
   - Duplicate transaction references are blocked by `payments_unique_reference_idx`. Once the owner verifies funds in their account and clicks **Verify & activate** in `/admin`, both `public.subscriptions` and `public.academies` activate automatically for the plan period.
2. **Dual White-Label Mode (Stateless URL + Verified Academy Slug Registry)**:
   - Educators can share instant stateless URLs (`/?brand=...&embed=1`) with students for zero-database-load embedding, OR register a verified `academy_slug` in `public.academies` queryable via `public.get_verified_academy_brand(p_slug)` while their subscription is active.
3. **Manual Economic Blackout Planner with One-Click Central Bank Presets**:
   - The Economic Event Risk Planner (`/tools?tool=events`) includes 6 one-click Tier-1 presets (US CPI, US NFP, FOMC, ECB, BoE, BoJ) so traders and tutors can schedule no-trade blackout windows in seconds without paying recurring third-party calendar API licensing fees.
4. **Seller Identifiers to Replace Upon Handover**:
   - See `BUYER_HANDOVER.md` for the 4 locations (`contact.tsx`, `white-label.tsx`, `site.tsx`, and AdSense/Search Console tags) to replace with your own brand and domain after running the verification tests.
