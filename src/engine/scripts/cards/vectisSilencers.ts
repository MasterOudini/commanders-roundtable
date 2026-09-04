// `Vectis Silencers` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { VECTIS_SILENCERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VECTIS_SILENCERS, "{2}{B}: This creature gains deathtouch until end of turn. (Any amount of damage it deals to a creature is enough to destroy that creature.)");

export const VECTIS_SILENCERS_SCRIPT: CardScript = {
  oracleId: VECTIS_SILENCERS.oracleId,
  name: VECTIS_SILENCERS.name,
  activated: [
    {
      ref: `${VECTIS_SILENCERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
