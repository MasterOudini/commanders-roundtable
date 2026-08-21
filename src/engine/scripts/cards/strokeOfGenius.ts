// `Stroke of Genius` — Braingeyser's shape: the TARGET draws X. D254.

import { STROKE_OF_GENIUS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STROKE_OF_GENIUS, 'Target player draws X cards.');

export const STROKE_OF_GENIUS_SCRIPT: CardScript = {
  oracleId: STROKE_OF_GENIUS.oracleId,
  name: STROKE_OF_GENIUS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
      return [...drawEvents(ctx.state, target.id, x)];
    },
  },
};
