// `Thrashing Brontodon` — Sylvok Replica's exact shape (D256) at one mana
// less: the self-sacrifice destroy on the artifact-or-enchantment compound,
// with the indestructible check that makes the Brontodon STAY SPENT when the
// target survives (Ark of Blight's no-refund rule, D162). D259.

import { THRASHING_BRONTODON } from '../../../data/fixtures/engineCards';
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
  THRASHING_BRONTODON,
  '{1}, Sacrifice this creature: Destroy target artifact or enchantment.',
);

export const THRASHING_BRONTODON_SCRIPT: CardScript = {
  oracleId: THRASHING_BRONTODON.oracleId,
  name: THRASHING_BRONTODON.name,
  activated: [
    {
      ref: `${THRASHING_BRONTODON.oracleId}#a0`,
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
