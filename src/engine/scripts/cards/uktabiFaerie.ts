// `Uktabi Faerie` — flying plus the self-sacrifice artifact destroy (Torch
// Fiend's shape, D262, one cost over). The keyword line never counts, so the
// def's text is `split[1]`. D263.

import { UKTABI_FAERIE } from '../../../data/fixtures/engineCards';
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
  UKTABI_FAERIE,
  'Flying\n{3}{G}, Sacrifice this creature: Destroy target artifact.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const UKTABI_FAERIE_SCRIPT: CardScript = {
  oracleId: UKTABI_FAERIE.oracleId,
  name: UKTABI_FAERIE.name,
  activated: [
    {
      // The keyword line is not an ability, so the destroy is #a0.
      ref: `${UKTABI_FAERIE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
        // The Faerie stays spent whether or not the destroy lands (D162).
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
