// `Gaze of Adamaro` — "Gaze of Adamaro deals damage to target player equal
// to the number of cards in that player's hand." D215.

import { GAZE_OF_ADAMARO } from '../../../data/fixtures/engineCards';
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
  GAZE_OF_ADAMARO,
  "Gaze of Adamaro deals damage to target player equal to the number of cards in that player's hand.",
);

export const GAZE_OF_ADAMARO_SCRIPT: CardScript = {
  oracleId: GAZE_OF_ADAMARO.oracleId,
  name: GAZE_OF_ADAMARO.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const n = (ctx.state.zones.hand[target.id] ?? []).length;
      if (n === 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: target.id },
              amount: n,
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
