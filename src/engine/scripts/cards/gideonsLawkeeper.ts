// `Gideon's Lawkeeper` — "{W}, {T}: Tap target creature." Benalish Trapper
// and Blinding Mage's EXACT printed text on a THIRD oracle id (D164's
// precedent), proven on its own. M6.4t, D176.

import { GIDEON_S_LAWKEEPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GIDEON_S_LAWKEEPER, '{W}, {T}: Tap target creature.');

export const GIDEONS_LAWKEEPER_SCRIPT: CardScript = {
  oracleId: GIDEON_S_LAWKEEPER.oracleId,
  name: GIDEON_S_LAWKEEPER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GIDEON_S_LAWKEEPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
