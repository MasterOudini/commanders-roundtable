// `Stream of Life` — "Target player gains X life." D254.

import { STREAM_OF_LIFE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STREAM_OF_LIFE, 'Target player gains X life.');

export const STREAM_OF_LIFE_SCRIPT: CardScript = {
  oracleId: STREAM_OF_LIFE.oracleId,
  name: STREAM_OF_LIFE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: x, to: player.life + x }];
    },
  },
};
