// `Lead Astray` — tap up to two target creatures.

import { LEAD_ASTRAY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LEAD_ASTRAY, 'Tap up to two target creatures.');

export const LEAD_ASTRAY_SCRIPT: CardScript = {
  oracleId: LEAD_ASTRAY.oracleId,
  name: LEAD_ASTRAY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const cards: string[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) continue;
        cards.push(target.id);
      }
      return cards.length > 0 ? [{ t: 'PermanentsTapped', cards }] : [];
    },
  },
};
