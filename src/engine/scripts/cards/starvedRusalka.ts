// `Starved Rusalka` — "{G}, Sacrifice a creature: You gain 1 life." The
// chooser gain; the Rusalka can pay with itself (CR 113.7a). D252.

import { STARVED_RUSALKA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STARVED_RUSALKA, '{G}, Sacrifice a creature: You gain 1 life.');

export const STARVED_RUSALKA_SCRIPT: CardScript = {
  oracleId: STARVED_RUSALKA.oracleId,
  name: STARVED_RUSALKA.name,
  activated: [
    {
      ref: `${STARVED_RUSALKA.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
