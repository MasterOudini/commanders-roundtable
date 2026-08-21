// `Starlight Invoker` — "{7}{W}: You gain 5 life." No tap anywhere. D252.

import { STARLIGHT_INVOKER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STARLIGHT_INVOKER, '{7}{W}: You gain 5 life.');

export const STARLIGHT_INVOKER_SCRIPT: CardScript = {
  oracleId: STARLIGHT_INVOKER.oracleId,
  name: STARLIGHT_INVOKER.name,
  activated: [
    {
      ref: `${STARLIGHT_INVOKER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: player.life + 5 }];
      },
    },
  ],
};
