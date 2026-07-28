import { useEffect, useState } from 'react';
import { Heart, Scale, Swords, WifiOff } from 'lucide-react';
import type { AppInfo } from '../../types/bridge';

// About + attribution.
//
// ⚠️ THIS SCREEN DISCHARGES A REAL OBLIGATION, not a courtesy. `docs/SCRYFALL.md`
// §4 holds the two strings below verbatim, and `scripts/probe.cjs` asserts they
// are present in the rendered text of a PRODUCTION build. If you reword them,
// change docs/SCRYFALL.md and the probe in the same commit — a refactor that
// quietly drops the Wizards Fan Content notice turns a personal tool into a
// policy breach, and nothing else in the codebase would notice.
//
// The offline section is here rather than in Settings because it answers a
// question people actually ask ("does this thing phone home?") and the honest
// answer is a short, complete list. Four exceptions, no telemetry, ever.

const CARD = 'rounded-lg border border-crt-border bg-crt-surface p-5';
const HEAD = 'font-sc mb-3 flex items-center gap-2 text-sm tracking-wider text-crt-dim';

/** ⚠️ Verbatim from docs/SCRYFALL.md §4. The probe asserts this string. */
const SCRYFALL_NOTICE =
  'Card data and card images are provided by Scryfall (scryfall.com). This application is not ' +
  'produced by, endorsed by, supported by, or affiliated with Scryfall.';

/** ⚠️ Verbatim from docs/SCRYFALL.md §4 — the Fan Content Policy boilerplate. */
const WIZARDS_NOTICE =
  "Commander's Roundtable is unofficial Fan Content permitted under the Fan Content Policy. " +
  'Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of ' +
  'the Coast. ©Wizards of the Coast LLC.';

/** The complete list. If you add a sixth, it needs the user's approval first. */
const CONNECTIONS: { what: string; where: string; when: string }[] = [
  {
    what: 'Card database',
    where: 'api.scryfall.com',
    when: 'Once, when you press “Download card database”. Never during a game.',
  },
  {
    what: 'Card pictures',
    where: 'cards.scryfall.io',
    when: 'When you import a deck, or the first time you see a card. Cached forever afterwards.',
  },
  {
    what: 'Importing a deck by link',
    where: 'moxfield.com, archidekt.com, tappedout.net',
    when: 'Only when you paste a deck link and press “Fetch decklist”. Never on its own.',
  },
  {
    what: 'Playing with friends',
    where: 'Your own network, or a relay you configured',
    when: 'Only while you are hosting or joined to a game.',
  },
  {
    what: 'App updates',
    where: 'github.com',
    when: 'At launch, to see whether a newer version exists.',
  },
];

export function AboutScreen() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void window.crt?.app.info().then(setInfo);
  }, []);

  return (
    <div className="flex-1 overflow-auto p-8" data-screen="about">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-start gap-3">
          <Swords size={22} className="mt-1 text-crt-accent" aria-hidden />
          <div>
            <h2 className="font-display text-lg">Commander&apos;s Roundtable</h2>
            <p className="mt-1 text-sm text-crt-dim">
              Play Magic: The Gathering — Commander with two to four friends, using decks you built
              yourself, with the app doing the rules bookkeeping.
            </p>
            {info && (
              <p className="crt-num mt-2 text-xs text-crt-faint" data-about="version">
                Version {info.version} · {info.isPackaged ? 'installed build' : 'development build'} ·
                Electron {info.versions.electron} · Chromium {info.versions.chrome}
              </p>
            )}
          </div>
        </header>

        <section className={CARD}>
          <h3 className={HEAD}>
            <Scale size={14} aria-hidden /> Attribution
          </h3>
          <p className="text-sm leading-relaxed text-crt-dim" data-about="scryfall">
            {SCRYFALL_NOTICE}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-crt-dim" data-about="wizards">
            {WIZARDS_NOTICE}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-crt-faint">
            Card pictures belong to Wizards of the Coast. They are never included in this app&apos;s
            installer and are never passed between players — every player&apos;s copy of the app
            downloads its own from Scryfall. That is why a friend who has just installed the app may
            see plain cards with the text written out until their pictures finish downloading.
          </p>
        </section>

        <section className={CARD}>
          <h3 className={HEAD}>
            <WifiOff size={14} aria-hidden /> What this app does on the internet
          </h3>
          <p className="text-sm text-crt-dim">
            Everything about playing works offline. These four are the only connections the app ever
            makes, and there is no analytics, tracking or telemetry of any kind — not switched off,
            not present.
          </p>
          <table className="mt-3 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="text-crt-faint">
                <th className="border-b border-crt-border py-1.5 pr-3 font-normal">For</th>
                <th className="border-b border-crt-border py-1.5 pr-3 font-normal">Where</th>
                <th className="border-b border-crt-border py-1.5 font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {CONNECTIONS.map((c) => (
                <tr key={c.what} className="align-top">
                  <td className="border-b border-crt-border/50 py-1.5 pr-3 text-crt-text">{c.what}</td>
                  <td className="crt-num border-b border-crt-border/50 py-1.5 pr-3 text-crt-dim">
                    {c.where}
                  </td>
                  <td className="border-b border-crt-border/50 py-1.5 text-crt-faint">{c.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={CARD}>
          <h3 className={HEAD}>What the app enforces, and what it leaves to you</h3>
          <p className="text-sm leading-relaxed text-crt-dim">
            The app always handles the bookkeeping: shuffling, mulligans, forty life, every phase and
            step, untapping, drawing, priority, paying costs, commander tax, the stack, combat damage,
            lethal damage, twenty-one commander damage, and the legend rule.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-crt-dim">
            It also enforces the common keyword abilities — flying, trample, deathtouch, first strike
            and the rest — wherever they change combat or casting.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-crt-dim">
            It deliberately does <em>not</em> try to understand what every individual card does. When
            a card says something unique, you read it and use the tools: move any card between any
            zones, make tokens, add counters, change life totals, tap or untap anything, reveal cards,
            roll dice, flip coins. If the table gets into a state nobody wanted, everyone can vote to
            rewind.
          </p>
        </section>

        <section className={CARD}>
          <h3 className={HEAD}>
            <Heart size={14} aria-hidden /> This build
          </h3>
          <p className="text-sm leading-relaxed text-crt-dim">
            A personal, non-commercial project, made to be sent to a few friends. It is free, it is
            not sold, and it does not take payment of any kind — which is what keeps it inside the Fan
            Content Policy quoted above.
          </p>
          {info && (
            <p className="crt-num mt-3 break-all text-xs text-crt-faint">
              Your files: {info.dataRoot}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
