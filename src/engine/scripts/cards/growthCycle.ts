// `Growth Cycle` — +3/+3 plus +2/+2 per card named Growth Cycle in my
// graveyard: Galvanic Bombardment's self-name census on a pump. D216.

import { GROWTH_CYCLE } from '../../../data/fixtures/engineCards';
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
  GROWTH_CYCLE,
  'Target creature gets +3/+3 until end of turn. It gets an additional +2/+2 until end of turn for each card named Growth Cycle in your graveyard.',
);

export const GROWTH_CYCLE_SCRIPT: CardScript = {
  oracleId: GROWTH_CYCLE.oracleId,
  name: GROWTH_CYCLE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let named = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.oracle.byPrinting(card.printingId)?.name === 'Growth Cycle') named++;
      }
      const n = 3 + 2 * named;
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: n, toughness: n }];
    },
  },
};
