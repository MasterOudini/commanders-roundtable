// `Stensia Bloodhall` — the priced ping LAND at #a1 behind the mana line:
// 2 damage to the probed player-or-planeswalker compound. D253.

import { STENSIA_BLOODHALL } from '../../../data/fixtures/engineCards';
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
  STENSIA_BLOODHALL,
  '{T}: Add {C}.\n{3}{B}{R}, {T}: This land deals 2 damage to target player or planeswalker.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const STENSIA_BLOODHALL_SCRIPT: CardScript = {
  oracleId: STENSIA_BLOODHALL.oracleId,
  name: STENSIA_BLOODHALL.name,
  activated: [
    {
      ref: `${STENSIA_BLOODHALL.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
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
