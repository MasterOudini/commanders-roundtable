// `Tortured Existence` — black mana and a discarded CREATURE card of my
// choice (the D286 chooser with a typed predicate) return a target creature
// card from my graveyard to my hand.

import { TORTURED_EXISTENCE } from '../../../data/fixtures/engineCards';
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
  TORTURED_EXISTENCE,
  '{B}, Discard a creature card: Return target creature card from your graveyard to your hand.',
);

export const TORTURED_EXISTENCE_SCRIPT: CardScript = {
  oracleId: TORTURED_EXISTENCE.oracleId,
  name: TORTURED_EXISTENCE.name,
  activated: [
    {
      ref: `${TORTURED_EXISTENCE.oracleId}#a0`,
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
                from: { kind: 'graveyard', player: card.owner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
