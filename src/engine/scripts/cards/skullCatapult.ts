// `Skull Catapult` — "{1}, {T}, Sacrifice a creature: This artifact deals 2
// damage to any target." Fodder Cannon one price down, at any target: an
// artifact's derived keywords read empty and the build says so. D248.

import { SKULL_CATAPULT } from '../../../data/fixtures/engineCards';
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
  SKULL_CATAPULT,
  '{1}, {T}, Sacrifice a creature: This artifact deals 2 damage to any target.',
);

export const SKULL_CATAPULT_SCRIPT: CardScript = {
  oracleId: SKULL_CATAPULT.oracleId,
  name: SKULL_CATAPULT.name,
  activated: [
    {
      ref: `${SKULL_CATAPULT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
        const d = ctx.derive(self);
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
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
