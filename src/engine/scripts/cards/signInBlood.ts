// `Sign in Blood` — "Target player draws two cards and loses 2 life."
// The targeted draw-and-bill. D247.

import { SIGN_IN_BLOOD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SIGN_IN_BLOOD, 'Target player draws two cards and loses 2 life.');

export const SIGN_IN_BLOOD_SCRIPT: CardScript = {
  oracleId: SIGN_IN_BLOOD.oracleId,
  name: SIGN_IN_BLOOD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
      return [
        ...drawEvents(ctx.state, target.id, 2),
        { t: 'LifeChanged', player: target.id, delta: -2, to: player.life - 2 },
      ];
    },
  },
};
