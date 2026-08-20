// `Ancient Craving` — Ambition's Cost's exact text on its own oracle id
// (the twin rule: each proven on its own). D197.

import { ANCIENT_CRAVING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ANCIENT_CRAVING, 'You draw three cards and you lose 3 life.');

export const ANCIENT_CRAVING_SCRIPT: CardScript = {
  oracleId: ANCIENT_CRAVING.oracleId,
  name: ANCIENT_CRAVING.name,
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
