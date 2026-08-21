// `Sudden Insight` — the DISTINCT-mana-value census over my graveyard's
// nonland cards (Lunar Insight's set, typed off the ORACLE face). D254.

import { SUDDEN_INSIGHT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
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
  SUDDEN_INSIGHT,
  'Draw a card for each different mana value among nonland cards in your graveyard.',
);

export const SUDDEN_INSIGHT_SCRIPT: CardScript = {
  oracleId: SUDDEN_INSIGHT.oracleId,
  name: SUDDEN_INSIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const values = new Set<number>();
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        if (faceOf(oc, inst.faceIndex).typeLine.types.includes('Land')) continue;
        values.add(oc.manaValue);
      }
      if (values.size === 0) return [];
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [...drawEvents(ctx.state, obj.controller, values.size)];
    },
  },
};
