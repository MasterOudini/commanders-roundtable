// `Natural Spring` — "Target player gains 8 life." D227.

import { NATURAL_SPRING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NATURAL_SPRING, 'Target player gains 8 life.');

export const NATURAL_SPRING_SCRIPT: CardScript = {
  oracleId: NATURAL_SPRING.oracleId,
  name: NATURAL_SPRING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: 8, to: p.life + 8 }];
    },
  },
};
