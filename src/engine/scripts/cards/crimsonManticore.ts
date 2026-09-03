// `Crimson Manticore` — damage on an ATTACKING creature; the combat role is the parser's and
// the validator's (D291). Generated from one table row (D292).

import { CRIMSON_MANTICORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRIMSON_MANTICORE, "Flying\n{R}, {T}: This creature deals 1 damage to target attacking or blocking creature.");
const TEXT = PRINTED.split('\n')[1] as string;

export const CRIMSON_MANTICORE_SCRIPT: CardScript = {
  oracleId: CRIMSON_MANTICORE.oracleId,
  name: CRIMSON_MANTICORE.name,
  activated: [
    {
      ref: `${CRIMSON_MANTICORE.oracleId}#a0`,
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
                amount: 1,
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
