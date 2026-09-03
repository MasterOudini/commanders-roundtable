// `Stern Constable` — the tap and a discarded card of my choice (D286) tap a
// creature.

import { STERN_CONSTABLE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STERN_CONSTABLE, '{T}, Discard a card: Tap target creature.');

export const STERN_CONSTABLE_SCRIPT: CardScript = {
  oracleId: STERN_CONSTABLE.oracleId,
  name: STERN_CONSTABLE.name,
  activated: [
    {
      ref: `${STERN_CONSTABLE.oracleId}#a0`,
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
