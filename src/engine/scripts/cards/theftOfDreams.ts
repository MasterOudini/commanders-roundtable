// `Theft of Dreams` — a draw per TAPPED creature the target opponent
// controls. The opponent restriction is ENFORCED at the aim (probed), so the
// resolve only counts. Zero tapped creatures is a true no-op rather than a
// draw of nothing. D259.

import { THEFT_OF_DREAMS } from '../../../data/fixtures/engineCards';
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
  THEFT_OF_DREAMS,
  'Draw a card for each tapped creature target opponent controls.',
);

export const THEFT_OF_DREAMS_SCRIPT: CardScript = {
  oracleId: THEFT_OF_DREAMS.oracleId,
  name: THEFT_OF_DREAMS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = ctx.state.players[target.id];
      if (!victim || victim.hasLost) return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== target.id || !inst.tapped) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) n += 1;
      }
      if (n === 0) return [];
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
