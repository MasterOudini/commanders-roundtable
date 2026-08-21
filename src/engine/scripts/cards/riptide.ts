// `Riptide` — "Tap all blue creatures." Blinding Light's filtered board
// tap with the colour read POSITIVE. D240.

import { RIPTIDE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RIPTIDE, 'Tap all blue creatures.');

export const RIPTIDE_SCRIPT: CardScript = {
  oracleId: RIPTIDE.oracleId,
  name: RIPTIDE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const cards = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.tapped) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.includes('U')) continue;
        cards.push(id);
      }
      if (cards.length === 0) return [];
      return [{ t: 'PermanentsTapped', cards }];
    },
  },
};
