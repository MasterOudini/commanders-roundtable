// `Undergrowth Leopard` — vigilance plus the self-sacrifice compound destroy.
// The 'artifact or enchantment' noun list is the Icy idiom (D199), PROBED
// green with both kinds enforced. The keyword line never counts, so the def's
// text is `split[1]`. D263.

import { UNDERGROWTH_LEOPARD } from '../../../data/fixtures/engineCards';
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
  UNDERGROWTH_LEOPARD,
  'Vigilance\n{1}, Sacrifice this creature: Destroy target artifact or enchantment.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const UNDERGROWTH_LEOPARD_SCRIPT: CardScript = {
  oracleId: UNDERGROWTH_LEOPARD.oracleId,
  name: UNDERGROWTH_LEOPARD.name,
  activated: [
    {
      ref: `${UNDERGROWTH_LEOPARD.oracleId}#a0`,
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
