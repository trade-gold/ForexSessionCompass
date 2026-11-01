<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All time math lives in src/lib/forex-time.ts using Intl + IANA zones (no hardcoded offsets), covered by src/test/forex-time.test.ts — keeps DST correct and testable.
- Live clocks use useNow() (null until hydrated) to avoid SSR hydration mismatches.
- Maintain public/sitemap.xml as the static inventory of public indexable pages, including valid session guides, whenever routes change; static delivery matches the requested public XML endpoint without altering tools.

- URL branding is validated in src/lib/white-label.ts and shared through BrandProvider; localStorage is read only after hydration to keep SSR stable.
- White-label exports are honest hosted embed wrappers; independent offline bundles are customization service deliverables, not mislabeled iframe downloads.
