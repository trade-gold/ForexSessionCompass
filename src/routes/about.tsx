import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site";

export const Route = createFileRoute("/about")({
  head: () => meta("About | Forex Time Tools", "About Forex Time Tools: free, accurate time and session utilities for forex traders worldwide.", "/about"),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="About" title="About Forex Time Tools" />
      <div className="prose-dark">
        <p>Forex Time Tools is a set of free utilities that help traders keep track of when the world's major financial centres are open. Traders in different countries constantly need to translate session hours, news release times and broker server times into their own clock, and daylight saving changes make that easy to get wrong.</p>
        <h2>How the tools work</h2>
        <p>Every clock and conversion is calculated in your browser using your device's clock and the IANA time zone database built into modern browsers. Nothing is hardcoded, so daylight saving transitions in London, New York, Sydney and elsewhere are applied automatically on the correct dates.</p>
        <h2>What we don't do</h2>
        <ul><li>We do not provide price data, signals or trading advice.</li><li>We do not publish testimonials or performance claims.</li><li>Session hours are common conventions and do not account for public holidays.</li></ul>
      </div>
    </div>
  ),
});
