// `Skyway Sniper` — Reach is the engine's; {2}{G}: 1 damage to a flyer (D289).

import { SKYWAY_SNIPER } from '../../../data/fixtures/engineCards';
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
  SKYWAY_SNIPER,
  'Reach (This creature can block creatures with flying.)\n{2}{G}: This creature deals 1 damage to target creature with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SKYWAY_SNIPER_SCRIPT: CardScript = {
  oracleId: SKYWAY_SNIPER.oracleId,
  name: SKYWAY_SNIPER.name,
  activated: [
    {
      ref: `${SKYWAY_SNIPER.oracleId}#a0`,
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
