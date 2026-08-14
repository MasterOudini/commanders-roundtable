// `Intrepid Hero` — "{T}: Destroy target creature with power 4 or greater."
// The activated destroy behind D139's numeric spec: the power floor is
// enforced at targeting, the indestructible check at resolution. M6.4z,
// D182.

import { INTREPID_HERO } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(INTREPID_HERO, '{T}: Destroy target creature with power 4 or greater.');

export const INTREPID_HERO_SCRIPT: CardScript = {
  oracleId: INTREPID_HERO.oracleId,
  name: INTREPID_HERO.name,
  activated: [
    {
      ref: `${INTREPID_HERO.oracleId}#a0`,
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
