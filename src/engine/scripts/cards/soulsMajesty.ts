// `Soul's Majesty` — "Draw cards equal to the power of target creature you
// control." The mid-sentence spec probed with the controller enforced. D250.

import { SOUL_S_MAJESTY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOUL_S_MAJESTY, 'Draw cards equal to the power of target creature you control.');

export const SOULS_MAJESTY_SCRIPT: CardScript = {
  oracleId: SOUL_S_MAJESTY.oracleId,
  name: SOUL_S_MAJESTY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const power = ctx.derive(target.id).power ?? 0;
      if (power <= 0) return [];
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [...drawEvents(ctx.state, obj.controller, power)];
    },
  },
};
