// `Pinpoint Avalanche` — "Pinpoint Avalanche deals 4 damage to target
// creature. The damage can't be prevented." Script damage never routes
// through combat.ts's preventedAmount — the engine's ONE prevention
// site — so the second sentence changes nothing today. This module's
// file name sits in prevention.node.test.ts's exclude list: the tripwire
// that fires the day noncombat prevention exists. D233.

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
            },
          ],
        },
      ];
    },
  },
};
