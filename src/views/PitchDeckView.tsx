const deckPdfUrl = new URL('../assets/pitch/LANDroid-Features.pdf', import.meta.url).href;
const deckPptxUrl = new URL('../assets/pitch/LANDroid-Features.pptx', import.meta.url).href;

export default function PitchDeckView() {
  return (
    <div className="flex h-full flex-col bg-parchment text-ink">
      <header className="border-b border-leather/30 bg-parchment-light px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">
              LANDroid Feature Deck
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={deckPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-leather/40 px-3 py-2 text-xs font-semibold text-leather hover:bg-leather/10"
            >
              Open PDF
            </a>
            <a
              href={deckPptxUrl}
              download="LANDroid-Features.pptx"
              className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-parchment hover:bg-ink-light"
            >
              Download PowerPoint
            </a>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 bg-ledger p-4">
        <iframe
          src={deckPdfUrl}
          title="LANDroid Feature Deck PDF preview"
          sandbox="allow-downloads"
          className="h-full w-full rounded-lg border border-ledger-line bg-white shadow-sm"
        />
      </section>
    </div>
  );
}
