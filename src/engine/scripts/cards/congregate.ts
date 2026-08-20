// `Congregate` — "Target player gains 2 life for each creature on the
// battlefield." Everyone's creatures count. D204.

import { CONGREGATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CONGREGATE, 'Target player gains 2 life for each creature on the battlefield.');

export const CONGREGATE_SCRIPT: CardScript = {
  oracleId: CONGREGATE.oracleId,
  name: CONGREGATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.derive(id).typeLine.types.includes('Creature')) n++;
      }
      if (n === 0) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: 2 * n, to: p.life + 2 * n }];
    },
  },
};
