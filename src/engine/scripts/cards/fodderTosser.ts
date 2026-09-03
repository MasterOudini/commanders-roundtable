// `Fodder Tosser` — the tap and a discarded card of my choice (D286) deal 2
// damage to a target player or planeswalker.

import { FODDER_TOSSER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FODDER_TOSSER, '{T}, Discard a card: This artifact deals 2 damage to target player or planeswalker.');

export const FODDER_TOSSER_SCRIPT: CardScript = {
  oracleId: FODDER_TOSSER.oracleId,
  name: FODDER_TOSSER.name,
  activated: [
    {
      ref: `${FODDER_TOSSER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
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
