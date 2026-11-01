import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site";

export const Route = createFileRoute("/disclaimer")({
  head: () => meta("Educational Disclaimer | Forex Time Tools", "Forex Time Tools is for education and time reference only and is not financial advice.", "/disclaimer"),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="Legal" title="Educational Disclaimer" />
      <div className="prose-dark">
        <p>The content and tools on Forex Time Tools are provided for educational and informational purposes only. Nothing on this site is financial, investment or trading advice, and nothing here is a recommendation to buy or sell any instrument.</p>
        <p>Trading foreign exchange on margin carries a high level of risk and may not be suitable for everyone. You could lose more than your initial deposit. Consider your objectives and experience, and seek advice from an independent, licensed professional if you have any doubts.</p>
        <p>Session times follow common conventions and may differ from your broker's definitions. They do not account for public holidays or unusual market closures. While we work to keep calculations accurate, we cannot guarantee the tools are free of errors; always confirm critical times with your broker.</p>
        <p>Descriptions of session characteristics are general observations and do not predict future market behaviour.</p>
      </div>
    </div>
  ),
});
