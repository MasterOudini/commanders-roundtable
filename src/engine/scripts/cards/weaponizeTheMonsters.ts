// `Weaponize the Monsters` — "{2}, Sacrifice a creature: This enchantment
// deals 2 damage to any target." The sacrifice chooser (D168) paying a ping
// whose SOURCE is the enchantment, so its own derived keywords decide how the
// damage lands. D268.

import { WEAPONIZE_THE_MONSTERS } from '../../../data/fixtures/engineCards';
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
  WEAPONIZE_THE_MONSTERS,
  '{2}, Sacrifice a creature: This enchantment deals 2 damage to any target.',
);

export const WEAPONIZE_THE_MONSTERS_SCRIPT: CardScript = {
  oracleId: WEAPONIZE_THE_MONSTERS.oracleId,
  name: WEAPONIZE_THE_MONSTERS.name,
  activated: [
    {
      ref: `${WEAPONIZE_THE_MONSTERS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
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
                amount: 2,
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
