import type { SessionId } from "./forex-time";

export const SESSION_CONTENT: Record<SessionId, { summary: string; traits: string[]; pairs: string[]; notes: string }> = {
  sydney: {
    summary: "The Sydney session opens the trading week after the weekend break. It is generally the quietest of the four major sessions, with activity centred on Australia and New Zealand.",
    traits: ["Often the first price action after the weekend, so weekend news can cause gaps at the open", "Typically lower liquidity than London or New York", "Australian and New Zealand economic releases are a common focus"],
    pairs: ["AUD/USD", "NZD/USD", "AUD/JPY", "AUD/NZD"],
    notes: "Australia observes daylight saving roughly from early October to early April, which is the opposite half of the year to Europe and North America. That shifts the Sydney window relative to other sessions twice a year.",
  },
  tokyo: {
    summary: "The Tokyo session represents the main Asian trading window. Japan is one of the largest forex centres, and activity in Asia also draws on Singapore and Hong Kong.",
    traits: ["The yen is heavily involved in trading during these hours", "Ranges are often narrower than in the London session, though this varies", "Japanese and Chinese data releases can be relevant"],
    pairs: ["USD/JPY", "EUR/JPY", "AUD/JPY", "GBP/JPY"],
    notes: "Japan does not observe daylight saving time, so Tokyo stays at UTC+09:00 all year. Its timing relative to London and New York still changes when those cities change their clocks.",
  },
  london: {
    summary: "London is widely regarded as the largest forex trading centre by turnover. The London session often accounts for a large share of daily volume.",
    traits: ["Generally high liquidity across major pairs", "Overlaps with Tokyo early and with New York in the afternoon", "UK and Eurozone economic releases often fall in this window"],
    pairs: ["EUR/USD", "GBP/USD", "EUR/GBP", "USD/CHF"],
    notes: "The UK moves between GMT (UTC+00:00) and BST (UTC+01:00), switching on the last Sunday of March and of October.",
  },
  newyork: {
    summary: "The New York session covers the main North American trading window. The US dollar is on one side of most forex trades, so US hours matter for many pairs.",
    traits: ["The morning overlap with London is often the most active part of the day", "Major US data releases are commonly scheduled around 08:30 New York time", "Activity tends to fade into the afternoon after London closes"],
    pairs: ["EUR/USD", "USD/JPY", "GBP/USD", "USD/CAD"],
    notes: "The US switches between EST (UTC−05:00) and EDT (UTC−04:00) on the second Sunday in March and the first Sunday in November. Because the US and UK change on different dates, the London–New York overlap shifts for a few weeks each year.",
  },
};
