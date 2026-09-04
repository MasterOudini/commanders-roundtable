// `Glimmering Angel` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { GLIMMERING_ANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLIMMERING_ANGEL, "Flying\n{U}: This creature gains shroud until end of turn. (It can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const GLIMMERING_ANGEL_SCRIPT: CardScript = {
  oracleId: GLIMMERING_ANGEL.oracleId,
  name: GLIMMERING_ANGEL.name,
  activated: [
    {
      ref: `${GLIMMERING_ANGEL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["shroud"] }];
      },
    },
  ],
};
