// `Planar Despair` — "Domain — All creatures get -1/-1 until end of turn
// for each basic land type among lands you control." Drag to the
// Bottom's sweep without the "1 plus". D234.

import { PLANAR_DESPAIR } from '../../../data/fixtures/engineCards';
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
  PLANAR_DESPAIR,
  'Domain — All creatures get -1/-1 until end of turn for each basic land type among lands you control.',
);

const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

export const PLANAR_DESPAIR_SCRIPT: CardScript = {
  oracleId: PLANAR_DESPAIR.oracleId,
  name: PLANAR_DESPAIR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const types = new Set<string>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Land')) continue;
        for (const b of BASICS) if (d.typeLine.subtypes.includes(b)) types.add(b);
      }
      const x = types.size;
      if (x === 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -x, toughness: -x });
      }
      return events;
    },
  },
};
