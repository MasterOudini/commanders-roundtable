// `Unstable Obelisk` — Universal Solvent's ability behind a mana line, so the
// def sits at #a1 rather than #a0: a MANA line counts as an ability, a keyword
// line never does. Landed as a twin in the same batch. D264.

import { UNSTABLE_OBELISK } from '../../../data/fixtures/engineCards';
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
  UNSTABLE_OBELISK,
  '{T}: Add {C}.\n{7}, {T}, Sacrifice this artifact: Destroy target permanent.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const UNSTABLE_OBELISK_SCRIPT: CardScript = {
  oracleId: UNSTABLE_OBELISK.oracleId,
  name: UNSTABLE_OBELISK.name,
  activated: [
    {
      ref: `${UNSTABLE_OBELISK.oracleId}#a1`,
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
