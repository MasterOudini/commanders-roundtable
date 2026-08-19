// `Eternal Isolation` — "Put target creature with power 4 or greater on
// the bottom of its owner's library." The D139 numeric floor enforced at
// the aim, and the move carries `placement: 'bottom'` — the D141 trap:
// without it the "removed" threat sits on top of its owner's next draw.
// D196.

import { ETERNAL_ISOLATION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  ETERNAL_ISOLATION,
  "Put target creature with power 4 or greater on the bottom of its owner's library.",
);

export const ETERNAL_ISOLATION_SCRIPT: CardScript = {
  oracleId: ETERNAL_ISOLATION.oracleId,
  name: ETERNAL_ISOLATION.name,
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
              placement: 'bottom',
            },
          ],
        },
      ];
    },
  },
};
