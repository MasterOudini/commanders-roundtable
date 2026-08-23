// `Universal Solvent` — the {7}, {T}, self-sacrifice destroy. Its whole text
// is this one ability, so the def is #a0; `Unstable Obelisk` is the same
// ability behind a mana line and sits at #a1. D264.

import { UNIVERSAL_SOLVENT } from '../../../data/fixtures/engineCards';
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
  UNIVERSAL_SOLVENT,
  '{7}, {T}, Sacrifice this artifact: Destroy target permanent.',
);

export const UNIVERSAL_SOLVENT_SCRIPT: CardScript = {
  oracleId: UNIVERSAL_SOLVENT.oracleId,
  name: UNIVERSAL_SOLVENT.name,
  activated: [
    {
      ref: `${UNIVERSAL_SOLVENT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
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
