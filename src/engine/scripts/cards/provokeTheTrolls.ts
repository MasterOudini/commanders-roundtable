// `Provoke the Trolls` — "Provoke the Trolls deals 3 damage to any
// target. If a creature is dealt damage this way, it gets +5/+0 until
// end of turn." The burn whose CREATURE branch angers its own victim.
// D235.

import { PROVOKE_THE_TROLLS } from '../../../data/fixtures/engineCards';
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
  PROVOKE_THE_TROLLS,
  'Provoke the Trolls deals 3 damage to any target. If a creature is dealt damage this way, it gets +5/+0 until end of turn.',
);

export const PROVOKE_THE_TROLLS_SCRIPT: CardScript = {
  oracleId: PROVOKE_THE_TROLLS.oracleId,
  name: PROVOKE_THE_TROLLS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'player') {
        const player = ctx.state.players[target.id];
        if (!player || player.hasLost) return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'player', id: target.id },
                amount: 3,
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
      }
      if (target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 3,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 5, toughness: 0 },
      ];
    },
  },
};
