// `Pinpoint Avalanche` — "Pinpoint Avalanche deals 4 damage to target
// creature. The damage can't be prevented."
//
// ⚠️ D233 shipped this on a VACUITY argument: script damage never routed
// through a prevention site, so the second sentence changed nothing, and
// `prevention.node.test.ts` was the tripwire that would fire the day that
// stopped being true. D382 built CR 615, so it has fired — and the sentence is
// modelled rather than vacuous now: `unpreventable` on the damage entry, which
// `prevention.ts` reads before it consults a single shield.

import { PINPOINT_AVALANCHE } from '../../../data/fixtures/engineCards';
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
  PINPOINT_AVALANCHE,
  "Pinpoint Avalanche deals 4 damage to target creature. The damage can't be prevented.",
);

export const PINPOINT_AVALANCHE_SCRIPT: CardScript = {
  oracleId: PINPOINT_AVALANCHE.oracleId,
  name: PINPOINT_AVALANCHE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 4,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
              unpreventable: true,
            },
          ],
        },
      ];
    },
  },
};
