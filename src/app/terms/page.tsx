// 21-legal: venue-not-party ToS essentials + IP models. Not legal advice —
// lawyer review required before launch (21 §7).
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-white">
      <h1 className="text-3xl font-bold">Terms (minimal, Phase 1-ready)</h1>
      <p className="mt-2 text-sm text-white/60">Klyro is a venue for team formation — not a party to any project&apos;s IP, employment, or equity arrangement (21 §4).</p>
      <section className="mt-8 space-y-4 text-sm leading-relaxed text-white/80">
        <h2 className="text-lg font-semibold text-white">Project IP models (chosen at creation, shown to every applicant)</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Owner-retained:</strong> owner owns output; contributors get credit + record, not equity.</li>
          <li><strong>Open source:</strong> MIT / Apache-2.0 / GPL-3.0 only — never free-text licenses.</li>
          <li><strong>Shared/equity:</strong> tracked off-platform on a real cap table; the checkbox here is not sufficient for real money — put it in writing separately.</li>
          <li><strong>Portfolio-only:</strong> non-commercial, learning/portfolio purposes.</li>
        </ul>
        <h2 className="text-lg font-semibold text-white">Contributor agreement</h2>
        <p>Accepting a role shows the project&apos;s IP model in plain language and requires explicit acceptance before membership activates. Contribution records attest to observed activity — not to IP ownership or employment status.</p>
        <h2 className="text-lg font-semibold text-white">Content &amp; accounts</h2>
        <p>You retain ownership of uploads; you grant Klyro a license to host, display, and back them up. Removed users&apos; records persist for team-history integrity (shown as de-identified where required). Disputes: in-product resolution first, then bounded platform review that annotates a record as “disputed” — the platform does not arbitrate IP, payment, or equity.</p>
        <p className="text-white/50">Minors: 13+; equity/IP-transfer models require parent/guardian acknowledgment where the user is a minor.</p>
      </section>
    </main>
  );
}
