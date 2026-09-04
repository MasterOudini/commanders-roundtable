// `Wintermoon Mesa` - tap on "Tap two target lands", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { WINTERMOON_MESA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WINTERMOON_MESA, "This land enters tapped.\n{T}: Add {C}.\n{2}, {T}, Sacrifice this land: Tap two target lands.");
const TEXT = PRINTED.split('\n')[2] as string;

export const WINTERMOON_MESA_SCRIPT: CardScript = {
  oracleId: WINTERMOON_MESA.oracleId,
  name: WINTERMOON_MESA.name,
  activated: [
    {
      ref: `${WINTERMOON_MESA.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          if (!card.tapped) out.push({ t: 'PermanentsTapped', cards: [target.id] });
        }
        return out;
      },
    },
  ],
};
