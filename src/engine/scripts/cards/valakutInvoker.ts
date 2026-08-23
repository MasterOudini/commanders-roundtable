// `Valakut Invoker` — the {8} any-target ping, sourced from the Invoker
// itself so its own derived keywords decide how the damage lands. D265.

import { VALAKUT_INVOKER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VALAKUT_INVOKER, '{8}: This creature deals 3 damage to any target.');

export const VALAKUT_INVOKER_SCRIPT: CardScript = {
  oracleId: VALAKUT_INVOKER.oracleId,
  name: VALAKUT_INVOKER.name,
  activated: [
    {
      ref: `${VALAKUT_INVOKER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        const applyAs =
          target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal';
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
                amount: 3,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs,
              },
            ],
          },
        ];
      },
    },
  ],
};
