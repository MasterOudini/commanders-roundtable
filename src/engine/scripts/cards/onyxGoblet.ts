// `Onyx Goblet` — "{T}: Target player loses 1 life." D230.

import { ONYX_GOBLET } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ONYX_GOBLET, '{T}: Target player loses 1 life.');

export const ONYX_GOBLET_SCRIPT: CardScript = {
  oracleId: ONYX_GOBLET.oracleId,
  name: ONYX_GOBLET.name,
  activated: [
    {
      ref: `${ONYX_GOBLET.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const p = ctx.state.players[target.id];
        if (!p || p.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: p.life - 1 }];
      },
    },
  ],
};
