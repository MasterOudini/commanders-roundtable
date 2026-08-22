// `Temporal Spring` — Temporal Eddy's placement (D257) on the wider noun:
// 'target permanent', which Scepter of Dominance proved reaches a LAND
// (D243). The library APPENDS and `drawFromTop` takes from the END, so the
// top is an explicit `placement: 'top'` rather than a bare move. D258.

import { TEMPORAL_SPRING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TEMPORAL_SPRING, "Put target permanent on top of its owner's library.");

export const TEMPORAL_SPRING_SCRIPT: CardScript = {
  oracleId: TEMPORAL_SPRING.oracleId,
  name: TEMPORAL_SPRING.name,
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
