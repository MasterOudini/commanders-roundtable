// `Drake Hatchling` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAKE_HATCHLING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAKE_HATCHLING, "Flying\n{U}: This creature gets +1/+0 until end of turn. Activate only once each turn.");
const LINES = PRINTED.split('\n');

export const DRAKE_HATCHLING_SCRIPT: CardScript = {
  oracleId: DRAKE_HATCHLING.oracleId,
  name: DRAKE_HATCHLING.name,
  activated: [
    {
      ref: `${DRAKE_HATCHLING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
