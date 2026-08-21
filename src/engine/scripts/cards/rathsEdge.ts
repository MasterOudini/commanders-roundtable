// `Rath's Edge` — "{4}, {T}, Sacrifice a land: Rath's Edge deals 1
// damage to any target." The land chooser paying an any-target ping on
// a legendary land; the mana line is the engine's. D237.

import { RATH_S_EDGE } from '../../../data/fixtures/engineCards';
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
  RATH_S_EDGE,
  "{T}: Add {C}.\n{4}, {T}, Sacrifice a land: Rath's Edge deals 1 damage to any target.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const RATHS_EDGE_SCRIPT: CardScript = {
  oracleId: RATH_S_EDGE.oracleId,
  name: RATH_S_EDGE.name,
  activated: [
    {
      ref: `${RATH_S_EDGE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
        if (target.kind === 'player' && !ctx.state.players[target.id]) return [];
        if (target.kind !== 'card' && target.kind !== 'player') return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'card'
                    ? { kind: 'card', id: target.id }
                    : { kind: 'player', id: target.id },
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
