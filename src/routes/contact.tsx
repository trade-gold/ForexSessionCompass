import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { meta, PageHeader } from "@/components/site";

export const Route = createFileRoute("/contact")({
  head: () =>
    meta(
      "Contact | Forex Time Tools",
      "Get in touch with Forex Time Tools to report an issue or suggest a feature.",
      "/contact",
    ),
  component: Contact,
});

const EMAIL = "kondivarun2@gmail.com";

function Contact() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanSubject = subject.trim() || "Forex Time Tools";
    const cleanMsg = msg.trim();
    if (!cleanName || !cleanMsg) {
      setNotice("Please enter both your name and a message.");
      return;
    }
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(`${cleanMsg}\n\n— ${cleanName}`)}`;
    setNotice("Opening your email client...");
    window.location.href = href;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader eyebrow="Contact" title="Contact us">
        Found a time calculation that looks wrong, need academy activation help, or have a tool idea? Send a message. This form opens your email app.
      </PageHeader>
      <form className="panel space-y-4 p-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="n" className="mb-1 block text-xs text-muted-foreground">
            Name
          </label>
          <input
            id="n"
            required
            maxLength={100}
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="s" className="mb-1 block text-xs text-muted-foreground">
            Subject
          </label>
          <input
            id="s"
            maxLength={150}
            className="field"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="m" className="mb-1 block text-xs text-muted-foreground">
            Message
          </label>
          <textarea
            id="m"
            required
            maxLength={2000}
            rows={6}
            className="field"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
        </div>
        {notice && (
          <p role="status" className="text-xs text-info">
            {notice}
          </p>
        )}
        <button
          type="submit"
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Open email to send
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Or email us directly at{" "}
        <a href={`mailto:${EMAIL}`} className="font-mono text-info hover:underline">
          {EMAIL}
        </a>
      </p>
    </div>
  );
}
