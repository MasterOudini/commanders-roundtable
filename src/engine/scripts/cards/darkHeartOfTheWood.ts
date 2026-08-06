// `Dark Heart of the Wood` — "Sacrifice a Forest: You gain 3 life." Aura
// Fracture's no-mana chooser cost with a LAND-SUBTYPE predicate: a Forest
// pays, any other land does not. M6.4m, D170.

import { DARK_HEART_OF_THE_WOOD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DARK_HEART_OF_THE_WOOD, 'Sacrifice a Forest: You gain 3 life.');

export const DARK_HEART_OF_THE_WOOD_SCRIPT: CardScript = {
  oracleId: DARK_HEART_OF_THE_WOOD.oracleId,
  name: DARK_HEART_OF_THE_WOOD.name,
  activated: [
    {
      ref: `${DARK_HEART_OF_THE_WOOD.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
