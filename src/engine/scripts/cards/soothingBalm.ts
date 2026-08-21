// `Soothing Balm` — "Target player gains 5 life." D249.

import { SOOTHING_BALM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOOTHING_BALM, 'Target player gains 5 life.');

export const SOOTHING_BALM_SCRIPT: CardScript = {
  oracleId: SOOTHING_BALM.oracleId,
  name: SOOTHING_BALM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: 5, to: player.life + 5 }];
    },
  },
};
