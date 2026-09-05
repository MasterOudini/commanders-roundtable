// `Stalking Drone` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STALKING_DRONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STALKING_DRONE, "Devoid (This card has no color.)\n{C}: This creature gets +1/+2 until end of turn. Activate only once each turn. ({C} represents colorless mana.)");
const LINES = PRINTED.split('\n');

export const STALKING_DRONE_SCRIPT: CardScript = {
  oracleId: STALKING_DRONE.oracleId,
  name: STALKING_DRONE.name,
  activated: [
    {
      ref: `${STALKING_DRONE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 2 }];
      },
    },
  ],
};
