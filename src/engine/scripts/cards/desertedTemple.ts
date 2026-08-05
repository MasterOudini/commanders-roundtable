// `Deserted Temple` — Land, "{T}: Add {C}.\n{1}, {T}: Untap target land." —
// the first TARGETED ActivatedDef (M6.4b, D159). The mana line is the
// engine's; the def owes the untap line, and its target rides the machinery
// the targeting work built for activated abilities (D79–D89): chosen at
// activation, re-checked at resolution (CR 608.2b).

import { DESERTED_TEMPLE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(DESERTED_TEMPLE, '{T}: Add {C}.\n{1}, {T}: Untap target land.');
const TEXT = PRINTED.split('\n')[1] as string;

export const DESERTED_TEMPLE_SCRIPT: CardScript = {
  oracleId: DESERTED_TEMPLE.oracleId,
  name: DESERTED_TEMPLE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the untap as ability 1.
      ref: `${DESERTED_TEMPLE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        // The same guard `effects.ts`'s untap uses: a target that left the
        // battlefield or already straightened gets no event — CR 608.2b's
        // total-fizzle case never reaches here, but a partial world must not
        // emit an untap for a card in a hand.
        if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
