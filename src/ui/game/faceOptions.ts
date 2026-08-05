import type { LegalAction } from '../../engine/legal';

// Which FACE of a card in hand you meant — the list the "Which half?" panel
// draws and the click path counts.
//
// ⚠️ PURE, in its own module, for `manaOptions.ts`'s reasons exactly: it is a
// policy decision about how to PRESENT the engine's legal actions, so it is a
// function of them and testable without a running app.
//
// ⚠️⚠️ **THE GAP THIS CLOSES IS NOT ONLY MODAL DFCs.** `legalActions` has
// offered every castable face since M3, and the click path did
// `legal.find(a => a.card === id)` — the FIRST match. So the second half of a
// SPLIT card (123 Commander-legal), the creature half of an ADVENTURE (134) and
// a modal DFC's back face (98) were all listed by the engine and unreachable by
// a person: **355 cards with a half nobody could play.** D155 gave the engine
// the face (it hardcoded 0 in `castSpell` and `playLand`); this gives it to the
// player, and without it the fix would be answerable by the bot, the fuzzer and
// the net driver and by nobody at the table — D143's lesson, in the same shape.

/** One face of a card in hand, and the intent that plays it. */
export interface FaceOption {
  readonly faceIndex: number;
  /** The face's own name — "Malakir Rebirth", "Malakir Mire". */
  readonly label: string;
  /** A land is a special action; a spell goes on the stack. */
  readonly kind: 'land' | 'cast';
  /** `false` for a cast whose cost cannot be met, so the panel can say so. */
  readonly affordable: boolean;
  readonly hasX: boolean;
}

/**
 * Every face of this card the player could play or cast right now.
 *
 * ⚠️ **ORDERED BY `faceIndex`, NEVER BY THE ORDER `legal` HAPPENS TO HOLD.** The
 * panel's rows are the card's own halves and they should read front-then-back the
 * way the card is printed; `legalActions` builds lands and casts in separate
 * passes, so an unsorted list would put a modal DFC's land half first on some
 * boards and second on others.
 *
 * ⚠️ An unaffordable cast IS included, marked. The mana panel settled this for
 * conditional mana (D110) and the same argument holds: a half the player cannot
 * pay for right now is still a half of their card, and hiding it is how a card
 * looks broken.
 */
export function faceOptionsFor(legal: readonly LegalAction[], card: string): FaceOption[] {
  const out: FaceOption[] = [];
  for (const a of legal) {
    if (a.t === 'PlayLand' && a.card === card) {
      out.push({ faceIndex: a.faceIndex, label: a.label, kind: 'land', affordable: true, hasX: false });
    } else if (a.t === 'CastSpell' && a.card === card) {
      out.push({
        faceIndex: a.faceIndex,
        label: a.label,
        kind: 'cast',
        affordable: a.affordable,
        hasX: a.hasX,
      });
    }
  }
  return out.sort((x, y) => x.faceIndex - y.faceIndex);
}
