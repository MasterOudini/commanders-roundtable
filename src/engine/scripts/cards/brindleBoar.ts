// `Brindle Boar` — "Sacrifice this creature: You gain 4 life." Bottle
// Gnomes's shape. M6.4i, D166.

import { BRINDLE_BOAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BRINDLE_BOAR, 'Sacrifice this creature: You gain 4 life.');

export const BRINDLE_BOAR_SCRIPT: CardScript = {
  oracleId: BRINDLE_BOAR.oracleId,
  name: BRINDLE_BOAR.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BRINDLE_BOAR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: player.life + 4 }];
      },
    },
  ],
};
