// `Amaranthine Wall` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { AMARANTHINE_WALL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMARANTHINE_WALL, "Defender\n{2}: This creature gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");
const LINES = PRINTED.split('\n');

export const AMARANTHINE_WALL_SCRIPT: CardScript = {
  oracleId: AMARANTHINE_WALL.oracleId,
  name: AMARANTHINE_WALL.name,
  activated: [
    {
      ref: `${AMARANTHINE_WALL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["indestructible"] }];
      },
    },
  ],
};
