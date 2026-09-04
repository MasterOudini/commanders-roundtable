// `Frog Butler` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { FROG_BUTLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FROG_BUTLER, "Deathtouch\n{T}: Add one mana of any color.\n{2}: This creature gains reach until end of turn.");
const LINES = PRINTED.split('\n');

export const FROG_BUTLER_SCRIPT: CardScript = {
  oracleId: FROG_BUTLER.oracleId,
  name: FROG_BUTLER.name,
  activated: [
    {
      ref: `${FROG_BUTLER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["reach"] }];
      },
    },
  ],
};
