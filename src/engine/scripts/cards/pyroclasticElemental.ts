// `Pyroclastic Elemental` — "{1}{R}{R}: This creature deals 1 damage to
// target player." The repeatable player-only ping. D236.

import { PYROCLASTIC_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PYROCLASTIC_ELEMENTAL, '{1}{R}{R}: This creature deals 1 damage to target player.');

export const PYROCLASTIC_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: PYROCLASTIC_ELEMENTAL.oracleId,
  name: PYROCLASTIC_ELEMENTAL.name,
  activated: [
    {
      ref: `${PYROCLASTIC_ELEMENTAL.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        if (!ctx.state.players[target.id]) return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'player', id: target.id },
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
