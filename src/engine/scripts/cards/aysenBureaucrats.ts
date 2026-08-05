// `Aysen Bureaucrats` — "{T}: Tap target creature with power 2 or less."
// Auriok Transfixer's tap under D139's numeric restriction: "power 2 or less"
// is ENFORCED by the targeting layer against the DERIVED power, so the def
// owes only the tap. M6.4f, D163.

import { AYSEN_BUREAUCRATS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AYSEN_BUREAUCRATS, '{T}: Tap target creature with power 2 or less.');

export const AYSEN_BUREAUCRATS_SCRIPT: CardScript = {
  oracleId: AYSEN_BUREAUCRATS.oracleId,
  name: AYSEN_BUREAUCRATS.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${AYSEN_BUREAUCRATS.oracleId}#a0`,
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
