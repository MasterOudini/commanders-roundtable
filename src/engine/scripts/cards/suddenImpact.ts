// `Sudden Impact` — Storm Seeker's EXACT text on a second oracle id (the
// Fisk precedent): the damage is the TARGET's hand size. D254.

import { SUDDEN_IMPACT } from '../../../data/fixtures/engineCards';
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
  SUDDEN_IMPACT,
  "Sudden Impact deals damage to target player equal to the number of cards in that player's hand.",
);

export const SUDDEN_IMPACT_SCRIPT: CardScript = {
  oracleId: SUDDEN_IMPACT.oracleId,
  name: SUDDEN_IMPACT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const amount = (ctx.state.zones.hand[target.id] ?? []).length;
      if (amount <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: target.id },
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
