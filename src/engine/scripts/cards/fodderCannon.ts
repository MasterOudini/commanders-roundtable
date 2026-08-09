// `Fodder Cannon` — "{4}, {T}, Sacrifice a creature: This artifact deals 4
// damage to target creature." Arms Dealer's chooser-fed damage from an
// ARTIFACT source — the derived keywords read empty, and that is what the
// build reports. M6.4s, D175.

import { FODDER_CANNON } from '../../../data/fixtures/engineCards';
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
  FODDER_CANNON,
  '{4}, {T}, Sacrifice a creature: This artifact deals 4 damage to target creature.',
);

export const FODDER_CANNON_SCRIPT: CardScript = {
  oracleId: FODDER_CANNON.oracleId,
  name: FODDER_CANNON.name,
  activated: [
    {
      ref: `${FODDER_CANNON.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'card', id: target.id },
                amount: 4,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
