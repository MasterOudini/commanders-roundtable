// `Caress of Phyrexia` — "Target player draws three cards, loses 3 life,
// and gets three poison counters." Draws through THE draw rule, then the
// life, then `PoisonChanged` — the first script to write poison directly.
// D202.

import { CARESS_OF_PHYREXIA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  CARESS_OF_PHYREXIA,
  'Target player draws three cards, loses 3 life, and gets three poison counters.',
);

export const CARESS_OF_PHYREXIA_SCRIPT: CardScript = {
  oracleId: CARESS_OF_PHYREXIA.oracleId,
  name: CARESS_OF_PHYREXIA.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [
        ...drawEvents(ctx.state, target.id, 3),
        { t: 'LifeChanged', player: target.id, delta: -3, to: p.life - 3 },
        { t: 'PoisonChanged', player: target.id, delta: 3, to: p.poison + 3 },
      ];
    },
  },
};
