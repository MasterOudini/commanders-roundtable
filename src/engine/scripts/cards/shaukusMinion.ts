// `Shauku's Minion` - damage on "This creature deals 2 damage to target white creature": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { SHAUKU_S_MINION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHAUKU_S_MINION, "{B}{R}, {T}: This creature deals 2 damage to target white creature.");
const TEXT = PRINTED;

export const SHAUKUS_MINION_SCRIPT: CardScript = {
  oracleId: SHAUKU_S_MINION.oracleId,
  name: SHAUKU_S_MINION.name,
  activated: [
    {
      ref: `${SHAUKU_S_MINION.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'card', id: target.id },
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
