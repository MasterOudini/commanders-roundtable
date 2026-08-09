// `Fountain of Youth` — "{2}, {T}: You gain 1 life." Book of Rass's fixed
// gain at trickle rates, repeatable across turns. M6.4s, D175.

import { FOUNTAIN_OF_YOUTH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FOUNTAIN_OF_YOUTH, '{2}, {T}: You gain 1 life.');

export const FOUNTAIN_OF_YOUTH_SCRIPT: CardScript = {
  oracleId: FOUNTAIN_OF_YOUTH.oracleId,
  name: FOUNTAIN_OF_YOUTH.name,
  activated: [
    {
      ref: `${FOUNTAIN_OF_YOUTH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
