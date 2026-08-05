// `Bile Urchin` — "Sacrifice this creature: Target player loses 1 life." A
// mana-free self-sacrifice with a PLAYER target: the whole cost is the body.
// M6.4g, D164.

import { BILE_URCHIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BILE_URCHIN, 'Sacrifice this creature: Target player loses 1 life.');

export const BILE_URCHIN_SCRIPT: CardScript = {
  oracleId: BILE_URCHIN.oracleId,
  name: BILE_URCHIN.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BILE_URCHIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const player = ctx.state.players[target.id];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: player.life - 1 }];
      },
    },
  ],
};
