// `Elite Headhunter` — "Menace\n{B/R}{B/R}{B/R}, Sacrifice another creature
// or an artifact: This creature deals 2 damage to target creature or
// planeswalker." A hybrid activation cost over the chooser's OR predicate
// with "another" (Ahriman's shape), dealing damage the way `damageTo` does.
// M6.4q, D173.

import { ELITE_HEADHUNTER } from '../../../data/fixtures/engineCards';
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
  ELITE_HEADHUNTER,
  "Menace (This creature can't be blocked except by two or more creatures.)\n" +
    '{B/R}{B/R}{B/R}, Sacrifice another creature or an artifact: This creature deals 2 damage to target creature or planeswalker.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ELITE_HEADHUNTER_SCRIPT: CardScript = {
  oracleId: ELITE_HEADHUNTER.oracleId,
  name: ELITE_HEADHUNTER.name,
  activated: [
    {
      ref: `${ELITE_HEADHUNTER.oracleId}#a0`,
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
                amount: 2,
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
