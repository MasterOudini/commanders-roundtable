// `Tor Wauki` — damage on an ATTACKING creature; the combat role is the parser's and
// the validator's (D291). Generated from one table row (D292).

import { TOR_WAUKI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOR_WAUKI, "{T}: Tor Wauki deals 2 damage to target attacking or blocking creature.");
const TEXT = PRINTED;

export const TOR_WAUKI_SCRIPT: CardScript = {
  oracleId: TOR_WAUKI.oracleId,
  name: TOR_WAUKI.name,
  activated: [
    {
      ref: `${TOR_WAUKI.oracleId}#a0`,
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
