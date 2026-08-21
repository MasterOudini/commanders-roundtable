// `Reckless Assault` — "{1}, Pay 2 life: This enchantment deals 1 damage
// to any target." Book of Rass's life price on a repeatable ping. D238.

import { RECKLESS_ASSAULT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RECKLESS_ASSAULT, '{1}, Pay 2 life: This enchantment deals 1 damage to any target.');

export const RECKLESS_ASSAULT_SCRIPT: CardScript = {
  oracleId: RECKLESS_ASSAULT.oracleId,
  name: RECKLESS_ASSAULT.name,
  activated: [
    {
      ref: `${RECKLESS_ASSAULT.oracleId}#a0`,
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
