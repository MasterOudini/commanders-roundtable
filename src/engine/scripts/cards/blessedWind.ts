// `Blessed Wind` — "Target player's life total becomes 20." Biorhythm's SET
// on one target: the delta is computed, a player already at 20 gets no
// event. D200.

import { BLESSED_WIND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BLESSED_WIND, "Target player's life total becomes 20.");

export const BLESSED_WIND_SCRIPT: CardScript = {
  oracleId: BLESSED_WIND.oracleId,
  name: BLESSED_WIND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      if (p.life === 20) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: 20 - p.life, to: 20 }];
    },
  },
};
