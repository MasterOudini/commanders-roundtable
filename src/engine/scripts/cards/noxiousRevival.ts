// `Noxious Revival` — "Put target card from a graveyard on top of its
// owner's library." The graveyard aim (any card, any graveyard) with a
// placement-top move. D229.

import { NOXIOUS_REVIVAL } from '../../../data/fixtures/engineCards';
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

// A SpellDef claims the FULL printed text, reminder line included (the
// Marrow Shards precedent).
const TEXT = printed(
  NOXIOUS_REVIVAL,
  "({G/P} can be paid with either {G} or 2 life.)\nPut target card from a graveyard on top of its owner's library.",
);

export const NOXIOUS_REVIVAL_SCRIPT: CardScript = {
  oracleId: NOXIOUS_REVIVAL.oracleId,
  name: NOXIOUS_REVIVAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: card.zone.player },
              to: { kind: 'library', player: card.owner },
              placement: 'top',
            },
          ],
        },
      ];
    },
  },
};
