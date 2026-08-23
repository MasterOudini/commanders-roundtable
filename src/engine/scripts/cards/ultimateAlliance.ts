// `Ultimate Alliance` — damage equal to MY creature count, at a creature.
//
// ⚠️ The count includes the TARGET when the target is mine: the card says
// "creatures you control" with no exclusion, so aiming it at my own creature
// is a real (if odd) play and the number is one higher than it looks. D263.

import { ULTIMATE_ALLIANCE } from '../../../data/fixtures/engineCards';
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
  ULTIMATE_ALLIANCE,
  'Ultimate Alliance deals damage equal to the number of creatures you control to target creature.',
);

export const ULTIMATE_ALLIANCE_SCRIPT: CardScript = {
  oracleId: ULTIMATE_ALLIANCE.oracleId,
  name: ULTIMATE_ALLIANCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];

      let amount = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) amount += 1;
      }
      if (amount <= 0) return [];

      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount,
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
