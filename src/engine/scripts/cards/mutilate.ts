// `Mutilate` — "All creatures get -1/-1 until end of turn for each Swamp
// you control." The Swamp census scales Nausea's board debuff; the SBA does
// the killing. D227.

import { MUTILATE } from '../../../data/fixtures/engineCards';
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
  MUTILATE,
  'All creatures get -1/-1 until end of turn for each Swamp you control.',
);

export const MUTILATE_SCRIPT: CardScript = {
  oracleId: MUTILATE.oracleId,
  name: MUTILATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.subtypes.includes('Swamp')) continue;
        n++;
      }
      if (n === 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -n, toughness: -n });
      }
      return events;
    },
  },
};
