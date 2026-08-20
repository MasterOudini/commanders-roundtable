// `Mathemagics` — "Target player draws 2ˣ cards." Exponential Growth's
// 2-to-the-X in one entry, spent on Braingeyser's target-draws shape; the
// cost is {X}{X}{U}{U} so the printed X is the spell's xValue, doubled in
// mana and exponential in cards. D224.

import { MATHEMAGICS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  MATHEMAGICS,
  'Target player draws 2ˣ cards. (2⁰ = 1, 2¹ = 2, 2² = 4, 2³ = 8, 2⁴ = 16, 2⁵ = 32, and so on.)',
);

export const MATHEMAGICS_SCRIPT: CardScript = {
  oracleId: MATHEMAGICS.oracleId,
  name: MATHEMAGICS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const player = ctx.state.players[target.id];
      if (!player || player.hasLost) return [];
      const count = 2 ** (obj.xValue ?? 0);
      return [...drawEvents(ctx.state, target.id, count)];
    },
  },
};
