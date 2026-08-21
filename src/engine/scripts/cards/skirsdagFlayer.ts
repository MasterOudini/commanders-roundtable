// `Skirsdag Flayer` — "{3}{B}, {T}, Sacrifice a Human: Destroy target
// creature." The Human-predicate chooser feeding a destroy — and the Flayer
// is ITSELF a Human, so it can pay its own cost (CR 113.7a). D248.

import { SKIRSDAG_FLAYER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SKIRSDAG_FLAYER, '{3}{B}, {T}, Sacrifice a Human: Destroy target creature.');

export const SKIRSDAG_FLAYER_SCRIPT: CardScript = {
  oracleId: SKIRSDAG_FLAYER.oracleId,
  name: SKIRSDAG_FLAYER.name,
  activated: [
    {
      ref: `${SKIRSDAG_FLAYER.oracleId}#a0`,
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
