import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, RotateCcw, WandSparkles } from "lucide-react";
import { meta, PageHeader, ZoneSelect } from "@/components/site";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/components/BrandProvider";
import {
  ACADEMY_PRESETS,
  DEMO_CONFIG,
  SERVICE_PRICES,
  THEME_PRESETS,
  brandedURL,
  configSearch,
  escapeHtml,
  parseBrandConfig,
  type BrandConfig,
} from "@/lib/white-label";
import { SESSIONS } from "@/lib/forex-time";

export const Route = createFileRoute("/white-label")({
  head: () =>
    meta(
      "White-Label & Pricing | Forex Time Tools",
      "Configure branded forex session clocks, shareable links and compact embeds. Educational customization services from $10.",
      "/white-label",
    ),
  component: WhiteLabel,
});

function WhiteLabel() {
  const { config } = useBrand();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<BrandConfig>({
    ...config,
    brand: config.brand ?? "FOREX TIME TOOLS",
    tz: config.tz ?? "UTC",
    fmt: config.fmt ?? "24",
    accent: config.accent ?? "#34d399",
    accent2: config.accent2 ?? "#38bdf8",
  });
  const [notice, setNotice] = useState("");

  const update = (patch: Partial<BrandConfig>) => setDraft((v) => ({ ...v, ...patch }));
  const clean = parseBrandConfig(configSearch(draft));
  const url = brandedURL({ ...clean, embed: false });
  const embedURL = brandedURL({ ...clean, embed: true });
  const safeTitle = escapeHtml(clean.title ?? clean.brand ?? "Forex session clock");
  const snippet = `<iframe src="${escapeHtml(embedURL)}" title="${safeTitle}" style="width:100%;height:900px;border:0" loading="lazy"></iframe>`;
  const json = JSON.stringify(clean, null, 2);

  const apply = (next: BrandConfig) => {
    setDraft({
      ...next,
      brand: next.brand ?? "FOREX TIME TOOLS",
      tz: next.tz ?? "UTC",
      fmt: next.fmt ?? "24",
      accent: next.accent ?? "#34d399",
      accent2: next.accent2 ?? "#38bdf8",
    });
    void navigate({ to: "/white-label", search: configSearch(next) });
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied.");
    } catch {
      setNotice("Copy unavailable; select and copy the text below.");
    }
  };

  const download = () => {
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeTitle}</title><body style="margin:0">${snippet}<script type="application/json" id="config">${json.replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const object = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = object;
    a.download = "branded-session-widget.html";
    a.click();
    URL.revokeObjectURL(object);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader eyebrow="For trading communities & academies" title="White-Label & Pricing">
        Configure your academy's branded session clock, custom theme colors, default timezone, and session labels. Share the generated URL directly with students—no individual student logins required.
      </PageHeader>

      <div className="mb-8 space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Demo Academy Configurations (Click to preview)
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => apply(DEMO_CONFIG)}>
            <WandSparkles className="mr-1.5 h-4 w-4" />
            Apex Pip Academy demo
          </Button>
          {ACADEMY_PRESETS.filter((p) => p.id !== "apex").map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="secondary"
              onClick={() => apply(preset.config)}
            >
              {preset.label}
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={() => apply({})}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Restore default brand
          </Button>
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <form
          className="panel space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            apply(clean);
          }}
        >
          <h2 className="text-xl font-semibold">Brand configuration</h2>
          {(
            [
              { key: "brand", label: "Community / Academy name" },
              { key: "title", label: "Browser page title" },
              { key: "logo", label: "Logo initials (up to 12 chars) or HTTPS image URL" },
            ] as const
          ).map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} className="mb-1 block text-sm">
                {f.label}
              </label>
              <input
                id={f.key}
                className="field"
                maxLength={f.key === "logo" ? 2048 : 160}
                value={draft[f.key] ?? ""}
                onChange={(e) => update({ [f.key]: e.target.value })}
              />
            </div>
          ))}

          <div>
            <p className="mb-2 text-sm">Theme color presets</p>
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => update({ accent: t.accent, accent2: t.accent2 })}
                  className="flex items-center gap-2 rounded-md border bg-panel px-2.5 py-1.5 text-xs hover:border-info"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.accent2 }}
                  />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border bg-panel p-3">
              <label htmlFor="brandaccent" className="text-sm">
                Primary theme color
              </label>
              <input
                id="brandaccent"
                type="color"
                value={draft.accent ?? "#34d399"}
                onChange={(e) => update({ accent: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border bg-panel"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-panel p-3">
              <label htmlFor="brandaccent2" className="text-sm">
                Secondary theme color
              </label>
              <input
                id="brandaccent2"
                type="color"
                value={draft.accent2 ?? "#38bdf8"}
                onChange={(e) => update({ accent2: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border bg-panel"
              />
            </div>
          </div>

          <div>
            <label htmlFor="brandtz" className="mb-1 block text-sm">
              Default time zone
            </label>
            <ZoneSelect
              id="brandtz"
              value={draft.tz ?? "UTC"}
              extra={draft.tz}
              onChange={(tz) => update({ tz })}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Clock format</span>
            <div className="flex gap-1">
              {(["24", "12"] as const).map((fmt) => (
                <Button
                  key={fmt}
                  type="button"
                  size="sm"
                  variant={draft.fmt === fmt ? "default" : "outline"}
                  aria-pressed={draft.fmt === fmt}
                  onClick={() => update({ fmt })}
                >
                  {fmt}H
                </Button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm">Displayed sessions & custom labels</legend>
            {SESSIONS.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <label className="flex w-28 shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!draft.sessions || draft.sessions.includes(s.id)}
                    onChange={(e) => {
                      const ids = draft.sessions ?? SESSIONS.map((item) => item.id);
                      const next = e.target.checked
                        ? [...ids, s.id]
                        : ids.filter((id) => id !== s.id);
                      if (next.length) update({ sessions: next });
                    }}
                  />
                  {s.name}
                </label>
                <input
                  aria-label={`${s.name} label`}
                  className="field min-w-0"
                  maxLength={60}
                  placeholder={s.name}
                  value={draft.labels?.[s.id] ?? ""}
                  onChange={(e) =>
                    update({ labels: { ...draft.labels, [s.id]: e.target.value } })
                  }
                />
              </div>
            ))}
          </fieldset>
          <Button type="submit" className="w-full">
            Apply branding
          </Button>
        </form>

        <div className="min-w-0 space-y-5">
          <h2 className="text-xl font-semibold">Branded clock preview</h2>
          <iframe
            key={embedURL}
            src={embedURL}
            title="Branded clock preview"
            className="h-[640px] w-full rounded border"
          />
          {(
            [
              { label: "Branded Client URL (Share with students)", value: url },
              { label: "Responsive iframe embed", value: snippet },
              { label: "JSON configuration", value: json },
            ] as const
          ).map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{item.label}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={`Copy ${item.label}`}
                  aria-label={`Copy ${item.label}`}
                  onClick={() => void copy(item.value)}
                >
                  <Copy />
                </Button>
              </div>
              <textarea
                readOnly
                aria-label={item.label}
                className="field min-h-24 font-mono text-xs"
                value={item.value}
              />
            </div>
          ))}
          <p role="status" className="text-sm text-info">
            {notice}
          </p>
          <Button type="button" variant="outline" onClick={download}>
            <Download className="mr-1.5 h-4 w-4" />
            Download HTML embed wrapper
          </Button>
          <p className="text-xs text-muted-foreground">
            This wrapper requires an internet connection to the hosted clock. An independent standalone HTML bundle is included in the advanced customization service.
          </p>
        </div>
      </section>

      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-semibold">Customization services & Academy Portal</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choose a one-time setup package or register an Academy Rental account to manage your branded student portal.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {(
            [
              {
                key: "basic" as const,
                title: "Basic Branding & Configuration",
                details:
                  "Custom community name, page title, primary & secondary theme colors, default timezone, 12h/24h format, and hosted shareable student link.",
                features: [
                  "Custom academy name & browser title",
                  "Primary & secondary brand color palette",
                  "Default student timezone & 12H/24H clock mode",
                  "Direct student share link (no student sign-up required)",
                ],
              },
              {
                key: "advanced" as const,
                title: "Advanced Customization & Embed Widget",
                details:
                  "Everything in Basic plus custom logo badge, custom session labels (e.g. Killzones), filtered sessions, responsive iframe widget code, and standalone HTML bundle.",
                features: [
                  "Custom HTTPS logo or academy monogram badge",
                  "Custom session labels & filtered session cards",
                  "Compact embed mode for Notion, Discord, or LMS portals",
                  "Downloadable HTML embed wrapper & JSON config",
                ],
              },
            ] as const
          ).map((t) => (
            <article key={t.key} className="panel flex flex-col justify-between p-6">
              <div>
                <p className="font-mono text-3xl font-bold text-primary">${SERVICE_PRICES[t.key]}</p>
                <h3 className="mt-3 text-lg font-semibold">{t.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.details}</p>
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-up" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="default">
                  <a href={`mailto:kondivarun2@gmail.com?subject=${encodeURIComponent(t.title)}`}>
                    Request customization
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/register">Register Academy Account</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Educational use only. This tool provides time and session data, not trading signals, and does not predict market direction. Trading carries a high risk of loss.
        </p>
      </section>
    </div>
  );
}
