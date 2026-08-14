// `Inspired Insurgent` — "{1}, Sacrifice this creature: Destroy target
// artifact or enchantment." The self-sacrifice riding the staged target
// chain, with Indrik Stomphowler's indestructible-checked destroy. M6.4z,
// D182.

import { INSPIRED_INSURGENT } from '../../../data/fixtures/engineCards';
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
  INSPIRED_INSURGENT,
  '{1}, Sacrifice this creature: Destroy target artifact or enchantment.',
);

export const INSPIRED_INSURGENT_SCRIPT: CardScript = {
  oracleId: INSPIRED_INSURGENT.oracleId,
  name: INSPIRED_INSURGENT.name,
  activated: [
    {
      ref: `${INSPIRED_INSURGENT.oracleId}#a0`,
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
