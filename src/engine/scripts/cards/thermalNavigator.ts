// `Thermal Navigator` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THERMAL_NAVIGATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THERMAL_NAVIGATOR, "Sacrifice an artifact: This creature gains flying until end of turn.");

export const THERMAL_NAVIGATOR_SCRIPT: CardScript = {
  oracleId: THERMAL_NAVIGATOR.oracleId,
  name: THERMAL_NAVIGATOR.name,
  activated: [
    {
      ref: `${THERMAL_NAVIGATOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
};
