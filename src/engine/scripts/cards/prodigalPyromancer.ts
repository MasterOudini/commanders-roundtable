// `Prodigal Pyromancer` — "{T}: This creature deals 1 damage to any
// target." The tap-ping, with the per-kind applyAs branch. D235.

import { PRODIGAL_PYROMANCER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PRODIGAL_PYROMANCER, '{T}: This creature deals 1 damage to any target.');

export const PRODIGAL_PYROMANCER_SCRIPT: CardScript = {
  oracleId: PRODIGAL_PYROMANCER.oracleId,
  name: PRODIGAL_PYROMANCER.name,
  activated: [
    {
      ref: `${PRODIGAL_PYROMANCER.oracleId}#a0`,
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
                target: target.kind === 'card' ? { kind: 'card', id: target.id } : { kind: 'player', id: target.id },
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
