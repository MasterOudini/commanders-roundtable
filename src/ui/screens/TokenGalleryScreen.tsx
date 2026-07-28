import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DUR, EASE, SPRING, STAGGER, d } from '../anim/tokens';
import { exposeDevHandles } from '../../devHandles';

// Dev screen (#tokens). Renders every design and motion token, and carries the
// three step-1 canaries the probe asserts against.
//
// Why a gallery is worth its keep here: two of the three failures it catches are
// SILENT. A missing font renders in a fallback that looks deliberate, and a
// zeroed Tailwind spacing utility looks like a design choice. Neither produces a
// console entry, so the only way to notice is to look at a page that would be
// obviously wrong.

const COLOR_TOKENS = [
  'crt-void', 'crt-table', 'crt-table-lo', 'crt-surface', 'crt-raised', 'crt-inset',
  'crt-border', 'crt-border-hi', 'crt-text', 'crt-dim', 'crt-faint',
  'crt-accent', 'crt-accent-hi', 'crt-accent-lo', 'crt-on-accent',
  'crt-ok', 'crt-warn', 'crt-danger', 'crt-cmd',
] as const;

// ⚠️ These five are reached by interpolation elsewhere (`identityToken()` builds
// `var(--color-mtg-${letter})`), which is exactly why `@theme static` is
// load-bearing — see D12. Listing them literally here does NOT make the app safe;
// it only makes this gallery render. Do not "simplify" index.css on the strength
// of this file.
const MTG_TOKENS = ['mtg-w', 'mtg-u', 'mtg-b', 'mtg-r', 'mtg-g', 'mtg-c', 'mtg-m'] as const;

const FONT_STACKS = [
  { cls: 'font-display', name: 'Alegreya Variable', role: 'Display · card names · player names' },
  { cls: 'font-sc', name: 'Alegreya SC', role: 'Type lines · section labels' },
  { cls: 'font-ui', name: 'Inter Variable', role: 'UI text' },
  { cls: 'font-rules', name: 'Crimson Pro Variable', role: 'Oracle text' },
  { cls: 'font-num', name: 'JetBrains Mono Variable', role: 'Every number · tabular' },
] as const;

/**
 * The 111-utility canary. Tailwind's p-1…p-8 must compute to 8 distinct values.
 *
 * ⚠️ The class names are written out LITERALLY, not built as `p-${n}`. Tailwind 4
 * scans source as text, so an interpolated utility is never emitted at all — the
 * element would then have no padding for a reason that has nothing to do with the
 * reset this canary exists to detect, and the canary would report a false alarm
 * forever. Same root cause as D12 (`@theme static`), different symptom.
 */
const PADDING_LADDER = [
  { rung: 1, cls: 'p-1' },
  { rung: 2, cls: 'p-2' },
  { rung: 3, cls: 'p-3' },
  { rung: 4, cls: 'p-4' },
  { rung: 5, cls: 'p-5' },
  { rung: 6, cls: 'p-6' },
  { rung: 7, cls: 'p-7' },
  { rung: 8, cls: 'p-8' },
] as const;

export function TokenGalleryScreen() {
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    exposeDevHandles({
      tokens: {
        colors: COLOR_TOKENS,
        mtg: MTG_TOKENS,
        durations: DUR,
        stagger: STAGGER,
        ease: EASE,
        spring: SPRING,

        /**
         * Are our real fonts loaded, or is a fallback silently rendering?
         * `false` here means every card name in the app is Georgia and nobody
         * noticed. Checked at 700 weight because the variable face has to cover
         * the whole axis, not just 400.
         */
        fontsLoaded: () =>
          FONT_STACKS.map((f) => ({
            name: f.name,
            check400: document.fonts.check(`400 16px "${f.name}"`),
            check700: document.fonts.check(`700 16px "${f.name}"`),
          })),

        /**
         * Computed padding for each rung of the ladder. An unlayered universal
         * reset zeroes all of them at once (it zeroed 111 utilities across two
         * sibling apps), and nothing about that failure is visible in a console.
         */
        paddingLadder: () =>
          PADDING_LADDER.map(({ rung }) => {
            const el = document.querySelector(`[data-probe="p${rung}"]`);
            return {
              rung,
              padding: el ? getComputedStyle(el).paddingTop : null,
            };
          }),

        /** Resolved value of a theme token, to prove @theme static emitted it. */
        resolve: (token: string) =>
          getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim(),

        /** A mounted motion.div, for the CSP check. */
        motionMounted: () => !!document.querySelector('[data-probe="motion-div"]'),
      },
    });
  }, []);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex max-w-5xl flex-col gap-8">
        <header>
          <h2 className="font-display text-lg">Design + motion tokens</h2>
          <p className="text-sm text-crt-dim">
            Everything the table is built from. If a swatch is transparent, a colour
            token was tree-shaken; if a font row looks like Georgia, a face failed to
            load; if the padding ladder is flat, a reset outranked the utilities.
          </p>
        </header>

        <Section title="Neutrals, accent, semantics">
          <div className="flex flex-wrap gap-2">
            {COLOR_TOKENS.map((t) => (
              <Swatch key={t} token={t} />
            ))}
          </div>
        </Section>

        <Section title="The five colours — lightness-matched, so none dominates">
          <div className="flex flex-wrap gap-2">
            {MTG_TOKENS.map((t) => (
              <Swatch key={t} token={t} />
            ))}
          </div>
        </Section>

        <Section title="Type">
          <div className="flex flex-col gap-3">
            {FONT_STACKS.map((f) => (
              <div key={f.cls} className="flex items-baseline gap-4">
                <span className="w-44 shrink-0 font-sc text-[11px] tracking-wider text-crt-faint">
                  {f.role}
                </span>
                <span className={`${f.cls} text-xl`} data-probe={`font-${f.cls}`}>
                  Kess, Dissident Mage — 3/4 · {'{'}2{'}'}{'{'}U{'}'}{'{'}B{'}'}{'{'}R{'}'}
                </span>
                <span className="font-num text-[11px] text-crt-faint">{f.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Spacing ladder — the 111-utility canary">
          <div className="flex flex-wrap items-end gap-2">
            {PADDING_LADDER.map(({ rung, cls }) => (
              <div
                key={rung}
                data-probe={`p${rung}`}
                className={`${cls} rounded border border-crt-border bg-crt-raised`}
              >
                <div className="h-3 w-3 rounded-sm bg-crt-accent" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Durations">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DUR).map(([name, ms]) => (
              <span
                key={name}
                className="rounded border border-crt-border bg-crt-inset px-2 py-0.5 text-[11px]"
              >
                {name} <span className="crt-num text-crt-accent-hi">{ms}</span>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Easings — watch the overshoot cross 1 and come back">
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            className="mb-3 self-start rounded border border-crt-border px-2 py-1 text-xs text-crt-dim hover:text-crt-text"
          >
            Replay
          </button>
          <div className="flex flex-col gap-2">
            {(Object.keys(EASE) as (keyof typeof EASE)[]).map((name) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-20 shrink-0 font-num text-[11px] text-crt-faint">{name}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded bg-crt-inset">
                  <motion.div
                    key={`${name}-${replay}`}
                    className="absolute top-1 h-4 w-4 rounded-sm bg-crt-accent"
                    data-probe={name === 'out' ? 'motion-div' : undefined}
                    initial={{ left: '0%' }}
                    animate={{ left: 'calc(100% - 1rem)' }}
                    transition={{ duration: d(600) / 1000, ease: EASE[name] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-sc text-xs tracking-wider text-crt-faint">{title}</h3>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex w-[104px] flex-col gap-1">
      <div
        className="h-10 rounded border border-crt-border"
        style={{ background: `var(--color-${token})` }}
        data-probe={`swatch-${token}`}
      />
      <span className="truncate font-num text-[10px] text-crt-faint">{token}</span>
    </div>
  );
}
