// `Kiss of the Amesha` — the target gains 7 and draws two. D221.

import { KISS_OF_THE_AMESHA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(KISS_OF_THE_AMESHA, 'Target player gains 7 life and draws two cards.');

export const KISS_OF_THE_AMESHA_SCRIPT: CardScript = {
  oracleId: KISS_OF_THE_AMESHA.oracleId,
  name: KISS_OF_THE_AMESHA.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [
        { t: 'LifeChanged', player: target.id, delta: 7, to: p.life + 7 },
        ...drawEvents(ctx.state, target.id, 2),
      ];
    },
  },
};
