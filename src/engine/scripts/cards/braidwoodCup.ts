// `Braidwood Cup` — "{T}: You gain 1 life." One tap, one life; an artifact,
// so no sickness gate. M6.4h, D165.

import { BRAIDWOOD_CUP } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BRAIDWOOD_CUP, '{T}: You gain 1 life.');

export const BRAIDWOOD_CUP_SCRIPT: CardScript = {
  oracleId: BRAIDWOOD_CUP.oracleId,
  name: BRAIDWOOD_CUP.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BRAIDWOOD_CUP.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
