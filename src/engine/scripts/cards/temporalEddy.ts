// `Temporal Eddy` — the creature-or-land compound (D213 added it after
// Fissure's own test refused a Mountain) put on TOP of its owner's library.
// The placement is Mystic Repeal's (D227), the other direction from the
// bottom-of-library removals. D257.

import { TEMPORAL_EDDY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TEMPORAL_EDDY, "Put target creature or land on top of its owner's library.");

export const TEMPORAL_EDDY_SCRIPT: CardScript = {
  oracleId: TEMPORAL_EDDY.oracleId,
  name: TEMPORAL_EDDY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'library', player: card.owner },
              placement: 'top',
            },
          ],
        },
      ];
    },
  },
};
