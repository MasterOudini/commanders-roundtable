import { useEffect, useRef, useState } from 'react';
import { Card } from '../card/Card';
import { CardZoomPanel } from '../card/CardZoomPanel';
import { FIXTURE_CARDS } from '../../data/fixtures/cards';
import { CARD_ASPECT, modeForHeight, type CardData } from '../../data/cardTypes';
import { exposeDevHandles } from '../../devHandles';

// Dev fixture screen (#cards). Renders every layout at every size band so card
// chrome, the synthetic-face fallback and mode selection can be verified before
// any real card data or table layout exists.
//
// Reachable at #cards in a dev build; the probe drives it through
// window.__crt.cards.

/** The size bands the real table uses. */
const HEIGHTS = [96, 120, 148, 208, 320] as const;

export function CardFixtureScreen() {
  const [zoomed, setZoomed] = useState<CardData | null>(null);
  const [real, setReal] = useState<CardData[] | null>(null);

  // Pull a spread of REAL cards out of the index, so this screen exercises the
  // whole path (worker → index → IPC → render) rather than only hand-written
  // fixtures. Falls back to fixtures when the database has not been built.
  useEffect(() => {
    const bridge = window.crt;
    if (!bridge) return;
    const names = [
      'Sol Ring', 'Lightning Bolt', 'Forest', 'Kess, Dissident Mage',
      'Delver of Secrets', 'Fire // Ice', 'Brazen Borrower', 'Chandra, Torch of Defiance',
      'Birgi, God of Storytelling', 'Nazgûl',
    ];
    void bridge.cardDb
      .resolveNames(names.map((name) => ({ name })))
      .then((results) => {
        const cards = results.map((r) => r.card).filter((c): c is CardData => c !== null);
        if (cards.length === 0) return;
        setReal(cards);
        // Queue the art. Crops land within a second or two and the cards upgrade
        // from synthetic faces to `chit` mode, then to full art.
        void bridge.images.prefetch(cards.map((c) => c.scryfallId));
      })
      .catch(() => { /* database not built — fixtures are the fallback */ });
  }, []);

  // Re-probe the cache as art arrives, so cards upgrade without a manual reload.
  // useCardImage only checks on mount, so bump a key to make it re-run.
  const [artEpoch, setArtEpoch] = useState(0);
  useEffect(() => {
    const bridge = window.crt;
    if (!bridge) return;
    return bridge.cardDb.onProgress((p) => {
      if (p.phase === 'images') setArtEpoch((n) => n + 1);
    });
  }, []);

  const shown = real ?? FIXTURE_CARDS;

  // ⚠️ Dev handles read through a ref, never a captured value. Registering them
  // once with `shown` in scope would freeze them at the fixture list, so
  // `zoom()` and `source()` would keep reporting fixtures after the real cards
  // arrived — a probe would then "prove" the index path was never used. Same
  // family as the stale-setter bug in App.tsx.
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const realRef = useRef(real);
  realRef.current = real;

  useEffect(() => {
    exposeDevHandles({
      cards: {
        fixtures: FIXTURE_CARDS,
        /** Whether real index data is being shown, and how many cards. */
        source: () => (realRef.current ? 'index' : 'fixtures'),
        realCount: () => realRef.current?.length ?? 0,
        heights: HEIGHTS,
        modeForHeight,
        /** What mode a given height should select — asserted by the probe. */
        modeOf: (height: number, faceDown = false) => modeForHeight(height, faceDown),
        /** Count of rendered cards currently showing a synthetic face. */
        syntheticCount: () => document.querySelectorAll('[data-synthetic-face="1"]').length,
        renderedCount: () => document.querySelectorAll('[data-card-id]').length,
        /**
         * Rendered geometry. Reports LAYOUT size (offsetWidth/Height), not
         * getBoundingClientRect — a tapped card is turned a full quarter turn, and
         * the client rect returns the card standing on its side, which fails an
         * aspect-ratio assertion for an entirely cosmetic reason. `rect` is kept
         * alongside for anything that genuinely needs on-screen extents.
         */
        geometry: () =>
          [...document.querySelectorAll('[data-card-id]')].map((el) => {
            const h = el as HTMLElement;
            const r = h.getBoundingClientRect();
            return {
              id: h.getAttribute('data-card-id'),
              mode: h.getAttribute('data-card-mode'),
              w: h.offsetWidth,
              h: h.offsetHeight,
              rect: { w: Math.round(r.width), h: Math.round(r.height) },
              transformed: getComputedStyle(h).transform !== 'none',
            };
          }),
        zoom: (name: string) =>
          setZoomed(shownRef.current.find((c) => c.name === name) ?? null),
      },
    });
  }, []);

  return (
    <div className="flex h-full overflow-auto p-6">
      <div className="flex flex-1 flex-col gap-8">
        <header>
          <h2 className="font-display text-lg">Card fixtures</h2>
          <p className="text-sm text-crt-dim">
            Every layout at every size band. Cards with no cached art fall back to a
            typeset face and stay fully playable — that is the intended cold-start
            appearance, not an error.
          </p>
        </header>

        {HEIGHTS.map((height) => (
          <section key={height} className="flex flex-col gap-2">
            <h3 className="font-sc text-xs tracking-wider text-crt-faint">
              {height}px · mode: {modeForHeight(height)}
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              {shown.map((c) => (
                <Card
                  key={`${c.scryfallId}-${height}-${artEpoch}`}
                  card={c}
                  height={height}
                  onClick={() => setZoomed(c)}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <h3 className="font-sc text-xs tracking-wider text-crt-faint">
            State chrome · 148px
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            {/* ⚠️ A tapped card is a full quarter turn, so its footprint is as
                wide as the card is TALL. Reserve that here, exactly as `packRow`
                reserves it on the battlefield, or the turn lands on top of the
                next demo card. */}
            <div style={{ width: 148, height: Math.round(148 * CARD_ASPECT) }}>
              <Card card={shown[0]!} height={148} tapped />
            </div>
            <Card card={shown[0]!} height={148} summoningSick />
            <Card card={shown[0]!} height={148} damage={2} />
            {/* Current P/T differing from printed 3/3 must be highlighted. */}
            <Card card={shown[0]!} height={148} power={5} toughness={5} />
            <Card card={shown[0]!} height={148} faceDown />
            <Card card={shown[Math.min(2, shown.length - 1)]!} height={148} pileCount={12} />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-sc text-xs tracking-wider text-crt-faint">
            Second faces · 148px
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            {shown.filter((c) => c.faces.length > 1).map((c) => (
              <Card key={`${c.scryfallId}-f1`} card={c} height={148} faceIndex={1} />
            ))}
          </div>
        </section>
      </div>

      {zoomed && (
        <aside className="ml-6 shrink-0">
          <CardZoomPanel card={zoomed} height={620} />
          <button
            type="button"
            onClick={() => setZoomed(null)}
            className="mt-2 w-full rounded border border-crt-border px-2 py-1 text-xs text-crt-dim hover:text-crt-text"
          >
            Close
          </button>
        </aside>
      )}
    </div>
  );
}
