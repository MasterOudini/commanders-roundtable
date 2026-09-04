// `Miner's Bane` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { MINER_S_BANE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINER_S_BANE, "{2}{R}: This creature gets +1/+0 and gains trample until end of turn. (It can deal excess combat damage to the player or planeswalker it's attacking.)");

export const MINERS_BANE_SCRIPT: CardScript = {
  oracleId: MINER_S_BANE.oracleId,
  name: MINER_S_BANE.name,
  activated: [
    {
      ref: `${MINER_S_BANE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["trample"] }];
      },
    },
  ],
};
