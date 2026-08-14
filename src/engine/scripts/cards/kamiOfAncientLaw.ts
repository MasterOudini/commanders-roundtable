// `Kami of Ancient Law` — "Sacrifice this creature: Destroy target
// enchantment." The no-mana self-sacrifice destroy (Felidar Cub's price,
// Indrik's resolve); Keening Apparition carries the identical text in this
// same batch. M6.4aa, D183.

import { KAMI_OF_ANCIENT_LAW } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(KAMI_OF_ANCIENT_LAW, 'Sacrifice this creature: Destroy target enchantment.');

export const KAMI_OF_ANCIENT_LAW_SCRIPT: CardScript = {
  oracleId: KAMI_OF_ANCIENT_LAW.oracleId,
  name: KAMI_OF_ANCIENT_LAW.name,
  activated: [
    {
      ref: `${KAMI_OF_ANCIENT_LAW.oracleId}#a0`,
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
