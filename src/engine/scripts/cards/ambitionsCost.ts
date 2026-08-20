// `Ambition's Cost` — "You draw three cards and you lose 3 life." Night's
// Whisper's shape at three, and ONE printed text on two oracle ids (Ancient
// Craving is the other) — both proven on their own. D197.

import { AMBITION_S_COST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(AMBITION_S_COST, 'You draw three cards and you lose 3 life.');

export const AMBITIONS_COST_SCRIPT: CardScript = {
  oracleId: AMBITION_S_COST.oracleId,
  name: AMBITION_S_COST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        ...drawEvents(ctx.state, obj.controller, 3),
        { t: 'LifeChanged', player: obj.controller, delta: -3, to: player.life - 3 },
      ];
    },
  },
};
