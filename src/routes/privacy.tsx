import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site";

export const Route = createFileRoute("/privacy")({
  head: () => meta("Privacy Policy | Forex Time Tools", "How Forex Time Tools handles your data: calculations run in your browser and no account is required.", "/privacy"),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader eyebrow="Legal" title="Privacy Policy" />
      <div className="prose-dark">
        <p>We aim to collect as little information as possible.</p>
        <h2>Calculations happen on your device</h2>
        <p>All clocks and conversions run in your browser. Times and dates you enter are not sent to our servers.</p>
        <h2>Local storage</h2>
        <p>If you choose a preferred time zone on the UTC to Local page, that choice is saved in your browser's local storage so it is remembered next time. You can clear it at any time through your browser settings.</p>
        <h2>Contact messages</h2>
        <p>The contact form opens your own email application. We only receive what you choose to send, and use it only to reply to you.</p>
        <h2>Hosting</h2>
        <p>Our hosting provider may process standard technical logs (such as IP address and browser type) to deliver and secure the site.</p>
        <h2>Changes</h2>
        <p>We may update this policy and will revise this page when we do.</p>
      </div>
    </div>
  ),
});
