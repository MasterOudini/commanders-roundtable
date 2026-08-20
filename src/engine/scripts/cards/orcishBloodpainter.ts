// `Orcish Bloodpainter` — "{T}, Sacrifice a creature: This creature deals
// 1 damage to any target." The creature chooser through the staged chain,
// paying for a ping. D230.

import { ORCISH_BLOODPAINTER } from '../../../data/fixtures/engineCards';
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
  ORCISH_BLOODPAINTER,
  '{T}, Sacrifice a creature: This creature deals 1 damage to any target.',
);

export const ORCISH_BLOODPAINTER_SCRIPT: CardScript = {
  oracleId: ORCISH_BLOODPAINTER.oracleId,
  name: ORCISH_BLOODPAINTER.name,
  activated: [
    {
      ref: `${ORCISH_BLOODPAINTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
