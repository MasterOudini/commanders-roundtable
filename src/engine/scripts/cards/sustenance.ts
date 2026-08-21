// `Sustenance` — the LAND-predicate chooser feeding a pump (Trenches'
// predicate, D177, on an enchantment). D255.

import { SUSTENANCE } from '../../../data/fixtures/engineCards';
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
  SUSTENANCE,
  '{1}, Sacrifice a land: Target creature gets +1/+1 until end of turn.',
);

export const SUSTENANCE_SCRIPT: CardScript = {
  oracleId: SUSTENANCE.oracleId,
  name: SUSTENANCE.name,
  activated: [
    {
      ref: `${SUSTENANCE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
