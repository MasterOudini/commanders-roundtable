// `Ridged Kusite` — two mana, the tap and a discarded card of my choice
// (D286) give a creature +1/+0 and first strike until cleanup.

import { RIDGED_KUSITE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  RIDGED_KUSITE,
  '{1}{B}, {T}, Discard a card: Target creature gets +1/+0 and gains first strike until end of turn.',
);

export const RIDGED_KUSITE_SCRIPT: CardScript = {
  oracleId: RIDGED_KUSITE.oracleId,
  name: RIDGED_KUSITE.name,
  activated: [
    {
      ref: `${RIDGED_KUSITE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 0, keywords: ['firstStrike'] }];
      },
    },
  ],
};
