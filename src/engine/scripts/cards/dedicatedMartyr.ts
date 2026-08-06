// `Dedicated Martyr` — "{W}, Sacrifice this creature: You gain 3 life."
// D159's self-sacrifice price with a gain behind it. M6.4m, D170.

import { DEDICATED_MARTYR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEDICATED_MARTYR, '{W}, Sacrifice this creature: You gain 3 life.');

export const DEDICATED_MARTYR_SCRIPT: CardScript = {
  oracleId: DEDICATED_MARTYR.oracleId,
  name: DEDICATED_MARTYR.name,
  activated: [
    {
      ref: `${DEDICATED_MARTYR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
