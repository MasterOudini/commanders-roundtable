// `Dogpile` — "Dogpile deals damage to any target equal to the number of
// attacking creatures you control." Blessed Reversal's combat read from
// the attacker's side: my declared attackers still on the battlefield.
// D209.

import { DOGPILE } from '../../../data/fixtures/engineCards';
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
  DOGPILE,
  'Dogpile deals damage to any target equal to the number of attacking creatures you control.',
);

export const DOGPILE_SCRIPT: CardScript = {
  oracleId: DOGPILE.oracleId,
  name: DOGPILE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      let n = 0;
      for (const a of ctx.state.combat?.attackers ?? []) {
        const card = ctx.state.cards[a.card];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.controller !== obj.controller) continue;
        n++;
      }
      if (n === 0) return [];
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
              amount: n,
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
};
