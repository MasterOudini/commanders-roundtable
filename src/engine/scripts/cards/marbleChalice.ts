// `Marble Chalice` — "{T}: You gain 1 life." Book of Rass's gain with the tap
// as the whole price, on an artifact the seam charges. M6.4ad, D186.

import { MARBLE_CHALICE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MARBLE_CHALICE, '{T}: You gain 1 life.');

export const MARBLE_CHALICE_SCRIPT: CardScript = {
  oracleId: MARBLE_CHALICE.oracleId,
  name: MARBLE_CHALICE.name,
  activated: [
    {
      ref: `${MARBLE_CHALICE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
