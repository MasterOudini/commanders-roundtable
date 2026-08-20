// `Mobilize` — "Untap all creatures you control." Metal Fatigue's mirror:
// one PermanentsUntapped batch over my tapped derived creatures. D226.

import { MOBILIZE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MOBILIZE, 'Untap all creatures you control.');

export const MOBILIZE_SCRIPT: CardScript = {
  oracleId: MOBILIZE.oracleId,
  name: MOBILIZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const cards = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || !card.tapped || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        cards.push(id);
      }
      if (cards.length === 0) return [];
      return [{ t: 'PermanentsUntapped', cards }];
    },
  },
};
