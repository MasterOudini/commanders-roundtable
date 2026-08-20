// `Metal Fatigue` — "Tap all artifacts." Blinding Light's board tap with the
// filter on the derived ARTIFACT type — every controller's, animated ones
// included. D224.

import { METAL_FATIGUE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(METAL_FATIGUE, 'Tap all artifacts.');

export const METAL_FATIGUE_SCRIPT: CardScript = {
  oracleId: METAL_FATIGUE.oracleId,
  name: METAL_FATIGUE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const cards = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.tapped) continue;
        if (!ctx.derive(id).typeLine.types.includes('Artifact')) continue;
        cards.push(id);
      }
      if (cards.length === 0) return [];
      return [{ t: 'PermanentsTapped', cards }];
    },
  },
};
