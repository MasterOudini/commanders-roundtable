// `Narnam Cobra` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { NARNAM_COBRA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NARNAM_COBRA, "{G}: This creature gains deathtouch until end of turn. (Any amount of damage it deals to a creature is enough to destroy it.)");

export const NARNAM_COBRA_SCRIPT: CardScript = {
  oracleId: NARNAM_COBRA.oracleId,
  name: NARNAM_COBRA.name,
  activated: [
    {
      ref: `${NARNAM_COBRA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
