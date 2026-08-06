// `Barrage of Expendables` — "{R}, Sacrifice a creature: This enchantment
// deals 1 damage to any target." Damage from a NON-CREATURE source through
// the same discipline as every other script ping: the derived source decides
// the damage riders, and an enchantment simply has none. M6.4l, D169.

import { BARRAGE_OF_EXPENDABLES } from '../../../data/fixtures/engineCards';
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
  BARRAGE_OF_EXPENDABLES,
  '{R}, Sacrifice a creature: This enchantment deals 1 damage to any target.',
);

export const BARRAGE_OF_EXPENDABLES_SCRIPT: CardScript = {
  oracleId: BARRAGE_OF_EXPENDABLES.oracleId,
  name: BARRAGE_OF_EXPENDABLES.name,
  activated: [
    {
      ref: `${BARRAGE_OF_EXPENDABLES.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
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
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs:
                  target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
