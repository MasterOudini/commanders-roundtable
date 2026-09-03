// `Forced Landing` — the flyer goes to the BOTTOM of its owner's library
// (Anchor to the Aether's move with the other placement). The flying
// restriction is the parser's and the validator's (D289).

import { FORCED_LANDING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FORCED_LANDING, "Put target creature with flying on the bottom of its owner's library.");

export const FORCED_LANDING_SCRIPT: CardScript = {
  oracleId: FORCED_LANDING.oracleId,
  name: FORCED_LANDING.name,
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
              placement: 'bottom',
            },
          ],
        },
      ];
    },
  },
};
