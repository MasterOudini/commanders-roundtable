// `Succumb to Temptation` — draw two, lose two. D254.

import { SUCCUMB_TO_TEMPTATION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(SUCCUMB_TO_TEMPTATION, 'You draw two cards and you lose 2 life.');

export const SUCCUMB_TO_TEMPTATION_SCRIPT: CardScript = {
  oracleId: SUCCUMB_TO_TEMPTATION.oracleId,
  name: SUCCUMB_TO_TEMPTATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        ...drawEvents(ctx.state, obj.controller, 2),
        { t: 'LifeChanged', player: obj.controller, delta: -2, to: player.life - 2 },
      ];
    },
  },
};
