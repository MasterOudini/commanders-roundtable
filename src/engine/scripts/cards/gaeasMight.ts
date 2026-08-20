// `Gaea's Might` — "Domain — Target creature gets +1/+1 until end of turn
// for each basic land type among lands you control." Drag Down's mirror.
// D215.

import { GAEA_S_MIGHT } from '../../../data/fixtures/engineCards';
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
  GAEA_S_MIGHT,
  'Domain — Target creature gets +1/+1 until end of turn for each basic land type among lands you control.',
);

const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

export const GAEAS_MIGHT_SCRIPT: CardScript = {
  oracleId: GAEA_S_MIGHT.oracleId,
  name: GAEA_S_MIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const types = new Set<string>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Land')) continue;
        for (const b of BASICS) if (d.typeLine.subtypes.includes(b)) types.add(b);
      }
      const x = types.size;
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: x }];
    },
  },
};
