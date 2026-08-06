// `Earthblighter` — "{2}{B}, {T}, Sacrifice a Goblin: Destroy target land."
// Arms Dealer's Goblin chooser paying for a destroy — a land answers to
// indestructible the same as anything else, so the derived check stays.
// M6.4p, D172.

import { EARTHBLIGHTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(EARTHBLIGHTER, '{2}{B}, {T}, Sacrifice a Goblin: Destroy target land.');

export const EARTHBLIGHTER_SCRIPT: CardScript = {
  oracleId: EARTHBLIGHTER.oracleId,
  name: EARTHBLIGHTER.name,
  activated: [
    {
      ref: `${EARTHBLIGHTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b — an indestructible permanent is not destroyed
        // (Darksteel Citadel is a real land this matters for).
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
