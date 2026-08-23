// `Volcanic Rambler` — "{2}{R}: This creature deals 1 damage to target player
// or planeswalker." No {T} in the cost, so it goes as many times as the mana
// allows. Chandra's Magmutt is the shipped precedent for the noun pair.
//
// ⚠️ Damage to a planeswalker is only MARKED in this engine (D257): the
// walker's `damage` moves and its loyalty does not — CR 306.8 is unbuilt.
// D267.

import { VOLCANIC_RAMBLER } from '../../../data/fixtures/engineCards';
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
  VOLCANIC_RAMBLER,
  '{2}{R}: This creature deals 1 damage to target player or planeswalker.',
);

export const VOLCANIC_RAMBLER_SCRIPT: CardScript = {
  oracleId: VOLCANIC_RAMBLER.oracleId,
  name: VOLCANIC_RAMBLER.name,
  activated: [
    {
      ref: `${VOLCANIC_RAMBLER.oracleId}#a0`,
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
