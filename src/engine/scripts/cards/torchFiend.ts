// `Torch Fiend` — D159's self-sacrifice cost with a targeted artifact
// destroy. The engine charges the {R} and eats the Fiend; this def only says
// what the ability DOES. D261.

import { TORCH_FIEND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TORCH_FIEND, '{R}, Sacrifice this creature: Destroy target artifact.');

export const TORCH_FIEND_SCRIPT: CardScript = {
  oracleId: TORCH_FIEND.oracleId,
  name: TORCH_FIEND.name,
  activated: [
    {
      ref: `${TORCH_FIEND.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
        // Destruction, so indestructible stops it (CR 701.7b) — and the Fiend
        // stays spent either way: an activated ability's cost is never
        // refunded (D162's Ark of Blight).
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
