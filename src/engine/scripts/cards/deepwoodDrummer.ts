// `Deepwood Drummer` — green mana, the tap and a discarded card of my choice
// (D286) give a creature +2/+2 until cleanup.

import { DEEPWOOD_DRUMMER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEEPWOOD_DRUMMER, '{G}, {T}, Discard a card: Target creature gets +2/+2 until end of turn.');

export const DEEPWOOD_DRUMMER_SCRIPT: CardScript = {
  oracleId: DEEPWOOD_DRUMMER.oracleId,
  name: DEEPWOOD_DRUMMER.name,
  activated: [
    {
      ref: `${DEEPWOOD_DRUMMER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] }];
      },
    },
  ],
};
