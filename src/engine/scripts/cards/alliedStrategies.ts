// `Allied Strategies` — "Domain — Target player draws a card for each basic
// land type among lands they control." The ability-word header rides the
// claimed text; the count is DISTINCT basic land subtypes among the TARGET
// player's derived lands, and the draws are theirs. D197.

import { ALLIED_STRATEGIES } from '../../../data/fixtures/engineCards';
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
  ALLIED_STRATEGIES,
  'Domain — Target player draws a card for each basic land type among lands they control.',
);

const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

export const ALLIED_STRATEGIES_SCRIPT: CardScript = {
  oracleId: ALLIED_STRATEGIES.oracleId,
  name: ALLIED_STRATEGIES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const types = new Set<string>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Land')) continue;
        for (const b of BASICS) if (d.typeLine.subtypes.includes(b)) types.add(b);
      }
      if (types.size === 0) return [];
      return drawEvents(ctx.state, target.id, types.size);
    },
  },
};
