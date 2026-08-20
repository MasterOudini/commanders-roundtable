// `Forced Retreat` — "Put target creature on top of its owner's library."
// Excommunicate's EXACT printed text on its own oracle id (the Benalish
// precedent). D214.

import { FORCED_RETREAT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FORCED_RETREAT, "Put target creature on top of its owner's library.");

export const FORCED_RETREAT_SCRIPT: CardScript = {
  oracleId: FORCED_RETREAT.oracleId,
  name: FORCED_RETREAT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
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
