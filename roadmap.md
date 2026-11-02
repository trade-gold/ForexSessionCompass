# Sitemap repair

# Cloud account repair
- [x] Verify Cloud readiness, all three migrations applied verbatim, and email authentication settings (confirmation remains on).
- [x] Correct the account client configuration and auth-lock contention; refresh a stale managed privileged binding without exposing credentials.
- [x] Test real registration, confirmed-account login, private academy profile reads, denied unauthorized activation, and logout; remove disposable test accounts.

- [x] Confirm real public pages and session guide URLs.
- [x] Add a static XML sitemap and its robots.txt directive.
- [x] Validate XML, crawling rules, and served URLs; clarify publication status.
- [x] Add the exact AdSense account tag to the global head without removing existing tags.
- [x] Verify the AdSense tag and sitemap on the live website: live XML and all 13 pages passed. This publishing request was declined, but the live site already contains both changes, so no further publish is needed for them.

# White-label & Academy Rental Enhancements

- [x] Add persistent 12H/24H formatting and validated URL branding configuration (including primary `accent` and secondary `accent2` colors).
- [x] Apply branding, session filtering/labels, compact embed mode, and clearly marked weekday simulation.
- [x] Add /white-label configurator, multi-academy demo switcher, exact $10/$25 service pricing, and export options.
- [x] Show helper messages for cleared converter/overlap/utc-to-local inputs.
- [x] Implement Academy Owner Branding Studio, Shareable Student Link Generator, Profile Editor, and Administrator Academy Management Console (`/academy`).
- [x] Add Multi-Timezone Desk Clocks, Saved Timezone Profiles, DST badges, US/UK DST gap indicator, and 24-hour visual overlap bars.
- [x] Preserve all existing pages, verification tags, sitemap, design, and IANA calculations; test central flows.
# Premium platform (staged)
- [x] Add a shared Pro/Elite feature catalogue to Plans and account pages with current subscription status, existing entitlement gates, and honest availability labels; verify signed-in access.
- [x] Stage 1: plans (Free/Pro/Elite, owner-configurable), subscriptions, manual payment review, owner console, feature gate, owner auto-admin on confirmed email.
- [ ] Stage 2: Risk & position calculator, Discipline guardian (Pro).
- [ ] Stage 3: Session planner, multi-timezone workspace, advanced overlap (Pro).
- [ ] Stage 4: Trade journal + analytics, manual economic event planner, reports, alerts (Elite).
- [ ] Stage 5: full production audit report.
