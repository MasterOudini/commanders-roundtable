// `Chilling Shade` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHILLING_SHADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHILLING_SHADE, "Flying\n{S}: This creature gets +1/+1 until end of turn. ({S} can be paid with one mana from a snow source.)");
const LINES = PRINTED.split('\n');

export const CHILLING_SHADE_SCRIPT: CardScript = {
  oracleId: CHILLING_SHADE.oracleId,
  name: CHILLING_SHADE.name,
  activated: [
    {
      ref: `${CHILLING_SHADE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
