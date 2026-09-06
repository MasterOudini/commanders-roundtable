// `Llanowar Augur` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LLANOWAR_AUGUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LLANOWAR_AUGUR, "Sacrifice this creature: Target creature gets +3/+3 and gains trample until end of turn. Activate only during your upkeep.");

export const LLANOWAR_AUGUR_SCRIPT: CardScript = {
  oracleId: LLANOWAR_AUGUR.oracleId,
  name: LLANOWAR_AUGUR.name,
  activated: [
    {
      ref: `${LLANOWAR_AUGUR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 3, toughness: 3, keywords: ["trample"] }];
      },
    },
  ],
};
