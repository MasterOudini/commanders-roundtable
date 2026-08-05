import { onBattlefield } from '../../view/types';
import type { PlayerView } from '../../view/types';
import type { LegalAction } from '../../engine/legal';

// What a mana source could put in the pool right now — the list the "Which
// mana?" panel draws and the click path counts.
//
// ⚠️ PURE, and in its own module for that reason: no React, no store, no
// session. It is a policy decision about how to PRESENT the engine's legal
// actions, which is why it does not live in `src/engine/legal.ts` — but it is
// still just a function of them, so it is tested the way `packRow` and
// `coalesce` are rather than only through a running app.

/** One thing this card can add, and the intent that adds it. */
export interface ManaOption {
  readonly abilityIndex: number;
  readonly outputChoice: number;
  /** Scryfall cost string, straight from the legal action: `{G}`, `{C}{C}`. */
  readonly cost: string;
  /**
   * The engine cannot promise this mana is spendable on a given cost ("Spend
   * this mana only to cast a creature spell"), so it is excluded from auto-tap.
   * It is still real mana and the player may still choose it.
   */
  readonly conditional: boolean;
}

/**
 * Everything this card could put in the pool right now, across ALL its mana
 * abilities.
 *
 * ⚠️ ACROSS ABILITIES, which is the whole reason this is a function rather than
 * a field on the legal action. A dual land is two abilities of one output each;
 * an any-colour land is one ability of five. Both are "this land can bring more
 * than one thing" to a player, and only the flattened list says so — reading
 * one action's output count answers a question nobody asked.
 *
 * ⚠️ CONDITIONAL OPTIONS ARE OFFERED TOO, marked rather than hidden. Cavern of
 * Souls settles it: one unconditional `{C}` and five restricted colours.
 * Offering only the unconditional half would leave every colour that card exists
 * for unreachable — exactly as it was before this panel, when clicking it did
 * nothing at all, because the click path looked for an unconditional ability and
 * took its first output.
 *
 * ⚠️ Deduped by what they ADD, with the unconditional one winning the slot. Two
 * buttons reading `{C}` above `{C}` and behaving differently is the one shape
 * this must never take. The Map keeps first-appearance order, so replacing a
 * value does not move it.
 */
/**
 * "Turn it, and nothing else" — the answer that adds no mana.
 *
 * ⚠️ TIER 3, and a different intent: it is `ManualSetTapped`, the same one the
 * card menu's button and the E key send, not a `TapForMana` with an empty
 * output. A mana ability that produced nothing would be a lie about the rules;
 * turning a card by hand is a tool, and the log marks it with the wrench.
 */
export const TAP_ONLY = 'tap-only';
export type TapChoice = ManaOption | typeof TAP_ONLY;

/**
 * May the panel offer to just turn this card?
 *
 * ⚠️ MINE, ON THE BATTLEFIELD, AND UNTAPPED. Not an opponent's: the E key and
 * the card menu still reach those, and a left-click that turned someone else's
 * permanent would make a misclick look like a play. Not one already turned:
 * "Tap" on a tapped card is not a choice, and untapping stays where it is.
 */
export function canTapOnly(view: PlayerView, card: string, viewer: string): boolean {
  const c = view.cards[card];
  if (!c || c.tapped || c.controller !== viewer) return false;
  return onBattlefield(view, card);
}

export function manaOptionsFor(legal: readonly LegalAction[], card: string): ManaOption[] {
  const byCost = new Map<string, ManaOption>();
  for (const action of legal) {
    if (action.t !== 'TapForMana' || action.card !== card) continue;
    action.outputs.forEach((cost, outputChoice) => {
      const option: ManaOption = {
        abilityIndex: action.abilityIndex,
        outputChoice,
        cost,
        conditional: action.conditional,
      };
      const prev = byCost.get(cost);
      if (!prev || (prev.conditional && !option.conditional)) byCost.set(cost, option);
    });
  }
  return [...byCost.values()];
}
