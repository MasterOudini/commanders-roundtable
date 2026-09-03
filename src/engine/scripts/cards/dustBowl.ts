// `Dust Bowl` - destroy on "Destroy target nonbasic land": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { DUST_BOWL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUST_BOWL, "{T}: Add {C}.\n{3}, {T}, Sacrifice a land: Destroy target nonbasic land.");
const TEXT = PRINTED.split('\n')[1] as string;

export const DUST_BOWL_SCRIPT: CardScript = {
  oracleId: DUST_BOWL.oracleId,
  name: DUST_BOWL.name,
  activated: [
    {
      ref: `${DUST_BOWL.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b - an indestructible permanent is not destroyed.
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
