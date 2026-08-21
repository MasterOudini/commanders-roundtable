// `Ruinous Gremlin` — "{2}{R}, Sacrifice this creature: Destroy target
// artifact." The self-sac priced artifact removal. D242.

import { RUINOUS_GREMLIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RUINOUS_GREMLIN, '{2}{R}, Sacrifice this creature: Destroy target artifact.');

export const RUINOUS_GREMLIN_SCRIPT: CardScript = {
  oracleId: RUINOUS_GREMLIN.oracleId,
  name: RUINOUS_GREMLIN.name,
  activated: [
    {
      ref: `${RUINOUS_GREMLIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
