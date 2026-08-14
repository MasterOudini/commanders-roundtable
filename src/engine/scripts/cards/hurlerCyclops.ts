// `Hurler Cyclops` — "{1}, Sacrifice another creature: This creature deals 1
// damage to any target." Ahriman's "another" predicate (the Cyclops can
// never eat itself) riding the staged chain, with Flamekin Spitfire's damage
// build. M6.4x, D180.

import { HURLER_CYCLOPS } from '../../../data/fixtures/engineCards';
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
  HURLER_CYCLOPS,
  '{1}, Sacrifice another creature: This creature deals 1 damage to any target.',
);

export const HURLER_CYCLOPS_SCRIPT: CardScript = {
  oracleId: HURLER_CYCLOPS.oracleId,
  name: HURLER_CYCLOPS.name,
  activated: [
    {
      ref: `${HURLER_CYCLOPS.oracleId}#a0`,
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
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect')
                  ? target.kind === 'player'
                    ? 'poison'
                    : 'wither'
                  : d.keywords.has('wither') && target.kind === 'card'
                    ? 'wither'
                    : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
