import { useEffect, useMemo, useRef, useState } from 'react';
import { salesDeckSlides, type SalesDeckSlide } from '../sales-deck/sales-deck-content';

const deckPdfUrl = new URL('../assets/pitch/LANDroid-Features.pdf', import.meta.url).href;
const deckPptxUrl = new URL('../assets/pitch/LANDroid-Features.pptx', import.meta.url).href;

export default function PitchDeckView() {
  const [activeIndex, setActiveIndex] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const activeSlide = salesDeckSlides[activeIndex] ?? salesDeckSlides[0];
  const progressLabel = `${activeIndex + 1} / ${salesDeckSlides.length}`;
  const nextSlideTitle = salesDeckSlides[(activeIndex + 1) % salesDeckSlides.length]?.title;

  const activeSlideTitle = useMemo(
    () => `${activeSlide.eyebrow}: ${activeSlide.title}`,
    [activeSlide]
  );

  const goPrevious = () => {
    setActiveIndex((index) => (index === 0 ? salesDeckSlides.length - 1 : index - 1));
  };

  const goNext = () => {
    setActiveIndex((index) => (index + 1) % salesDeckSlides.length);
  };

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeIndex]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-parchment text-ink">
      <header className="border-b border-leather/30 bg-parchment-light px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">
              LANDroid Sales Deck
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-light">
              Native status slides for current product story, recent progress, and next
              milestones. Legacy pitch assets remain available below the slide controls.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-ledger-line bg-ledger px-3 py-2 text-xs font-semibold text-ink-light">
              Slide {progressLabel}
            </span>
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

      <section className="flex min-h-0 flex-1 flex-col bg-ledger lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="border-b border-ledger-line bg-parchment-light p-3 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1 lg:overflow-x-visible">
            {salesDeckSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-current={activeIndex === index ? 'step' : undefined}
                className={`w-56 shrink-0 rounded-md border px-3 py-2 text-left transition-colors lg:w-full ${
                  activeIndex === index
                    ? 'border-leather bg-leather text-parchment shadow-sm'
                    : 'border-transparent text-ink-light hover:border-ledger-line hover:bg-ledger'
                }`}
              >
                <span className="block text-[0.65rem] font-semibold uppercase tracking-wide opacity-75">
                  {String(index + 1).padStart(2, '0')} / {slide.eyebrow}
                </span>
                <span className="mt-1 block text-sm font-semibold leading-snug">
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main ref={mainRef} className="min-h-0 overflow-y-auto p-3 sm:p-4">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4">
            <SalesSlide slide={activeSlide} ariaLabel={activeSlideTitle} />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ledger-line bg-parchment-light p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-leather">
                  Up next
                </p>
                <p className="truncate text-sm text-ink-light">{nextSlideTitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrevious}
                  className="rounded-md border border-leather/40 px-3 py-2 text-sm font-semibold text-leather hover:bg-leather/10"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-parchment hover:bg-ink-light"
                >
                  Next
                </button>
              </div>
            </div>

            <section className="rounded-md border border-ledger-line bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Legacy Reference Deck
                  </h3>
                  <p className="mt-1 max-w-3xl text-sm text-ink-light">
                    The original bundled feature deck remains available for comparison
                    and offline PowerPoint use.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={deckPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-leather/40 px-3 py-2 text-xs font-semibold text-leather hover:bg-leather/10"
                  >
                    Open PDF
                  </a>
                  <a
                    href={deckPptxUrl}
                    download="LANDroid-Features.pptx"
                    className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-parchment hover:bg-ink-light"
                  >
                    Download PowerPoint
                  </a>
                </div>
              </div>
              <div className="mt-4 h-[32rem] overflow-hidden rounded-md border border-ledger-line bg-white">
                <iframe
                  src={deckPdfUrl}
                  title="LANDroid legacy feature deck PDF preview"
                  sandbox="allow-downloads"
                  className="h-full w-full bg-white"
                />
              </div>
            </section>
          </div>
        </main>
      </section>
    </div>
  );
}

function SalesSlide({
  slide,
  ariaLabel,
}: {
  slide: SalesDeckSlide;
  ariaLabel: string;
}) {
  return (
    <article
      aria-label={ariaLabel}
      className="min-h-[34rem] rounded-md border border-leather/30 bg-parchment-light shadow-sm"
    >
      <div className="grid min-h-[34rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col justify-between p-5 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-leather">
              {slide.eyebrow}
            </p>
            <h3 className="mt-3 max-w-4xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
              {slide.title}
            </h3>
            <p className="mt-5 max-w-3xl text-base leading-7 text-ink-light sm:text-lg sm:leading-8">
              {slide.summary}
            </p>
          </div>

          <ul className="mt-8 grid gap-3">
            {slide.points.map((point) => (
              <li
                key={point}
                className="rounded-md border border-ledger-line bg-ledger px-4 py-3 text-sm leading-6 text-ink sm:text-base sm:leading-7"
              >
                {point}
              </li>
            ))}
          </ul>

          {slide.footer && (
            <p className="mt-6 border-t border-ledger-line pt-4 text-xs font-semibold uppercase text-leather">
              {slide.footer}
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-6 border-t border-ledger-line bg-ink p-5 text-parchment sm:p-6 xl:border-l xl:border-t-0">
          <div>
            <p className="text-xs font-semibold uppercase text-gold-light">
              LANDroid
            </p>
            <p className="mt-3 font-display text-2xl font-bold leading-tight">
              Status deck for live product conversations
            </p>
          </div>

          {slide.stat ? (
            <div className="rounded-md border border-parchment/20 bg-parchment/10 p-4">
              <p className="text-xs font-semibold uppercase text-gold-light">
                {slide.stat.label}
              </p>
              <p className="mt-2 break-words font-display text-3xl font-bold">
                {slide.stat.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-parchment/75">
                {slide.stat.detail}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-parchment/20 bg-parchment/10 p-4">
              <p className="text-xs font-semibold uppercase text-gold-light">
                Slide focus
              </p>
              <p className="mt-2 text-sm leading-6 text-parchment/75">
                Built to be updated every few days from the current repo docs and
                product notes.
              </p>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
