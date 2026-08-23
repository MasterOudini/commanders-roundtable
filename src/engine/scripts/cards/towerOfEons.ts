// `Tower of Eons` — the {8}, {T} cycle's life gain, and the only member of
// the four that targets nothing. D261.

import { TOWER_OF_EONS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TOWER_OF_EONS, '{8}, {T}: You gain 10 life.');

export const TOWER_OF_EONS_SCRIPT: CardScript = {
  oracleId: TOWER_OF_EONS.oracleId,
  name: TOWER_OF_EONS.name,
  activated: [
    {
      ref: `${TOWER_OF_EONS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 10, to: player.life + 10 }];
      },
    },
  ],
};
