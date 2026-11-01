import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearch } from "@tanstack/react-router";
import { parseBrandConfig, type BrandConfig, type ClockFormat } from "@/lib/white-label";
import { formatTime, isValidZone } from "@/lib/forex-time";
import { Button } from "@/components/ui/button";

const Context = createContext<{
  config: BrandConfig;
  fmt: ClockFormat;
  setFmt: (v: ClockFormat) => void;
  preferredTz: string | null;
  setPreferredTz: (tz: string) => void;
}>({
  config: {},
  fmt: "24",
  setFmt: () => {},
  preferredTz: null,
  setPreferredTz: () => {},
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const search = useSearch({ strict: false });
  const config = parseBrandConfig(search as Record<string, unknown>);
  const [preference, setPreference] = useState<ClockFormat | null>(null);
  const [preferredTz, setPreferredTzState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("fsc_fmt");
      if (s === "12" || s === "24") setPreference(s);
      const savedTz = localStorage.getItem("fsc_preferred_tz") ?? localStorage.getItem("ftt-zone");
      if (savedTz && isValidZone(savedTz)) {
        setPreferredTzState(savedTz);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  useEffect(() => {
    if (config.fmt) {
      setPreference(config.fmt);
      try {
        localStorage.setItem("fsc_fmt", config.fmt);
      } catch {
        // Ignore storage access errors
      }
    }
  }, [config.fmt]);

  useEffect(() => {
    if (!config.title) return;
    const old = document.title;
    document.title = config.title;
    return () => {
      document.title = old;
    };
  }, [config.title, search]);

  useEffect(() => {
    const root = document.documentElement;
    const primaryTokens = ["--primary", "--up", "--ring"] as const;
    if (config.accent) {
      for (const token of primaryTokens) root.style.setProperty(token, config.accent);
      if (!config.accent2) root.style.setProperty("--info", config.accent);
    }
    if (config.accent2) {
      root.style.setProperty("--info", config.accent2);
    }
    return () => {
      for (const token of ["--primary", "--up", "--info", "--ring"] as const) {
        root.style.removeProperty(token);
      }
    };
  }, [config.accent, config.accent2]);

  const fmt = preference ?? config.fmt ?? "24";
  const setFmt = (v: ClockFormat) => {
    setPreference(v);
    try {
      localStorage.setItem("fsc_fmt", v);
    } catch {
      // Ignore storage access errors
    }
  };

  const setPreferredTz = (tz: string) => {
    if (!isValidZone(tz)) return;
    setPreferredTzState(tz);
    try {
      localStorage.setItem("fsc_preferred_tz", tz);
      localStorage.setItem("ftt-zone", tz);
    } catch {
      // Ignore storage access errors
    }
  };

  return (
    <Context.Provider value={{ config, fmt, setFmt, preferredTz, setPreferredTz }}>
      {children}
    </Context.Provider>
  );
}

export function useBrand() {
  return useContext(Context);
}

export function useClockFormat() {
  const { fmt } = useBrand();
  return (date: Date, tz: string, seconds = false) => formatTime(date, tz, seconds, fmt);
}

export function FormatToggle() {
  const { fmt, setFmt } = useBrand();
  return (
    <div className="flex shrink-0 gap-1" role="group" aria-label="Clock format">
      {(["24", "12"] as const).map((v) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant={fmt === v ? "default" : "outline"}
          aria-pressed={fmt === v}
          onClick={() => setFmt(v)}
        >
          {v}H
        </Button>
      ))}
    </div>
  );
}
