// `Presence of the Wise` — "You gain 2 life for each card in your hand."
// Peach Garden Oath's census one zone over. D234.

import { PRESENCE_OF_THE_WISE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PRESENCE_OF_THE_WISE, 'You gain 2 life for each card in your hand.');

export const PRESENCE_OF_THE_WISE_SCRIPT: CardScript = {
  oracleId: PRESENCE_OF_THE_WISE.oracleId,
  name: PRESENCE_OF_THE_WISE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      const gain = 2 * (ctx.state.zones.hand[obj.controller] ?? []).length;
      if (gain === 0) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: gain, to: player.life + gain }];
    },
  },
};
