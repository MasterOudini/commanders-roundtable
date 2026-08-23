// `Wandering Stream` — Domain: 2 life per BASIC LAND TYPE among my lands.
// TYPES, not lands: two Islands are one type, and a dual with two types is
// worth two on its own. Allied Strategies' shape (D-batch), gain instead of
// draw. D267.

import { WANDERING_STREAM } from '../../../data/fixtures/engineCards';
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
  WANDERING_STREAM,
  'Domain — You gain 2 life for each basic land type among lands you control.',
);

const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

export const WANDERING_STREAM_SCRIPT: CardScript = {
  oracleId: WANDERING_STREAM.oracleId,
  name: WANDERING_STREAM.name,
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
      if (types.size === 0) return [];
      const amount = types.size * 2;
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: amount, to: me.life + amount }];
    },
  },
};
