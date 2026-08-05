// `Cathar Commando` — "Flash\n{1}, Sacrifice this creature: Destroy target
// artifact or enchantment." Capashen Unicorn's shape behind flash. M6.4i,
// D166.

import { CATHAR_COMMANDO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  CATHAR_COMMANDO,
  'Flash\n{1}, Sacrifice this creature: Destroy target artifact or enchantment.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const CATHAR_COMMANDO_SCRIPT: CardScript = {
  oracleId: CATHAR_COMMANDO.oracleId,
  name: CATHAR_COMMANDO.name,
  activated: [
    {
      // The keyword line parses as nothing; the destroy is ability 0.
      ref: `${CATHAR_COMMANDO.oracleId}#a0`,
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
