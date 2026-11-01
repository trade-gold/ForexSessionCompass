import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useBrand } from "@/components/BrandProvider";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { ZONES } from "@/lib/forex-time";

export const SITE_ORIGIN = "https://forex-session-compass.lovable.app";
export const OG_IMAGE_URL = `${SITE_ORIGIN}/og-image.png`;

const NAV = [
  { to: "/", label: "Session Clock" },
  { to: "/converter", label: "Converter" },
  { to: "/overlap", label: "Overlaps" },
  { to: "/utc-to-local", label: "UTC → Local" },
  { to: "/sessions", label: "Sessions" },
  { to: "/white-label", label: "White-Label & Pricing" },
  { to: "/demo", label: "Buyer Demo" },
] as const;

const ACCOUNT_LINK =
  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

function AccountLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { session, isAdmin, signOut } = useAuth();
  if (!session) {
    return (
      <>
        <Link
          to="/login"
          search={(prev) => prev}
          onClick={onNavigate}
          className={ACCOUNT_LINK}
        >
          Log in
        </Link>
        <Link
          to="/register"
          search={(prev) => prev}
          onClick={onNavigate}
          className="rounded-md bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
        >
          Register
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        to="/academy"
        search={(prev) => prev}
        onClick={onNavigate}
        className={ACCOUNT_LINK}
        activeProps={{ className: "bg-accent text-foreground font-medium" }}
      >
        {isAdmin ? "Admin & Dashboard" : "Dashboard"}
      </Link>
      <Link
        to="/profile"
        search={(prev) => prev}
        onClick={onNavigate}
        className={ACCOUNT_LINK}
        activeProps={{ className: "bg-accent text-foreground font-medium" }}
      >
        My Profile
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onNavigate?.();
          void signOut();
        }}
      >
        Log out
      </Button>
    </>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { config } = useBrand();
  return (
    <header className="sticky top-0 z-40 border-b bg-panel/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link
          to="/"
          search={(prev) => prev}
          className="flex min-w-0 items-center gap-2 font-mono text-sm font-bold"
        >
          <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-up" />
          {config.logo &&
            (config.logo.startsWith("https://") ? (
              <img
                src={config.logo}
                alt=""
                width={28}
                height={28}
                loading="eager"
                decoding="async"
                className="h-7 w-7 shrink-0 object-contain"
              />
            ) : (
              <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded border border-primary bg-primary/10 px-1.5 text-xs text-primary">
                {config.logo}
              </span>
            ))}
          <span className="max-w-48 truncate">
            {config.brand ?? (
              <>
                FOREX<span className="text-info">TIME</span>TOOLS
              </>
            )}
          </span>
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              search={(prev) => prev}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground font-medium" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1.5 lg:flex">
          <AccountLinks />
        </div>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col border-t bg-panel px-4 py-3 lg:hidden" aria-label="Mobile navigation">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              search={(prev) => prev}
              onClick={() => setOpen(false)}
              className="py-2 text-sm text-muted-foreground"
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{ className: "text-up font-medium" }}
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-3">
            <AccountLinks onNavigate={() => setOpen(false)} />
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { config } = useBrand();
  return (
    <footer className="mt-16 border-t bg-panel">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted-foreground md:grid-cols-[2fr_1fr]">
        <p className="max-w-xl">
          {config.brand ?? "Forex Time Tools"} provides time and session information for educational purposes only. It is not financial advice, and no tool here predicts prices or guarantees results. Trading carries a high risk of loss.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
          <Link to="/about" search={(prev) => prev} className="hover:text-foreground">
            About
          </Link>
          <Link to="/contact" search={(prev) => prev} className="hover:text-foreground">
            Contact
          </Link>
          <Link to="/privacy" search={(prev) => prev} className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/disclaimer" search={(prev) => prev} className="hover:text-foreground">
            Disclaimer
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <p className="font-mono text-xs uppercase tracking-widest text-info">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h1>
      {children && <p className="mt-3 max-w-2xl text-muted-foreground">{children}</p>}
    </div>
  );
}

export function ZoneSelect({
  value,
  onChange,
  id,
  extra,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string | undefined;
  extra?: string | undefined;
}) {
  const list =
    extra && !ZONES.some((z) => z.tz === extra)
      ? [{ label: `Your zone (${extra})`, tz: extra }, ...ZONES]
      : ZONES;
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((z) => (
        <option key={z.tz} value={z.tz}>
          {z.label} — {z.tz}
        </option>
      ))}
    </select>
  );
}

export function meta(title: string, description: string, canonicalPath = "/") {
  const normalizedPath = canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`;
  const canonicalUrl = `${SITE_ORIGIN}${normalizedPath}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:site_name", content: "Forex Time Tools" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: OG_IMAGE_URL },
      { name: "twitter:image:alt", content: title },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}
