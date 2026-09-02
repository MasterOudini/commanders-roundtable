// `Terashi's Cry` — tap up to three target creatures.

import { TERASHI_S_CRY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TERASHI_S_CRY, 'Tap up to three target creatures.');

export const TERASHIS_CRY_SCRIPT: CardScript = {
  oracleId: TERASHI_S_CRY.oracleId,
  name: TERASHI_S_CRY.name,
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
