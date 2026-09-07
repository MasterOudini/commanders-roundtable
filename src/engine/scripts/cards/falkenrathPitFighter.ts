// `Falkenrath Pit Fighter` - an activation drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FALKENRATH_PIT_FIGHTER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(FALKENRATH_PIT_FIGHTER, "{1}{R}, Discard a card, Sacrifice a Vampire: Draw two cards. Activate only if an opponent lost life this turn.");

export const FALKENRATH_PIT_FIGHTER_SCRIPT: CardScript = {
  oracleId: FALKENRATH_PIT_FIGHTER.oracleId,
  name: FALKENRATH_PIT_FIGHTER.name,
  activated: [
    {
      ref: `${FALKENRATH_PIT_FIGHTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
  ],
};
