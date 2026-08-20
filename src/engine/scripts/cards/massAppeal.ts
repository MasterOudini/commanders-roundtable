// `Mass Appeal` — draw one per Human I control. D223.

import { MASS_APPEAL } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(MASS_APPEAL, 'Draw a card for each Human you control.');

export const MASS_APPEAL_SCRIPT: CardScript = {
  oracleId: MASS_APPEAL.oracleId,
  name: MASS_APPEAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Human')) n++;
      }
      if (n === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, n)];
    },
  },
};
