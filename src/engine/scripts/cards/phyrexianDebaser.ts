// `Phyrexian Debaser` — "{T}, Sacrifice this creature: Target creature
// gets -2/-2 until end of turn." The tapped self-sacrifice debuff behind
// Flying. D232.

import { PHYREXIAN_DEBASER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  PHYREXIAN_DEBASER,
  'Flying\n{T}, Sacrifice this creature: Target creature gets -2/-2 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PHYREXIAN_DEBASER_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_DEBASER.oracleId,
  name: PHYREXIAN_DEBASER.name,
  activated: [
    {
      ref: `${PHYREXIAN_DEBASER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2 }];
      },
    },
  ],
};
