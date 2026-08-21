// `Storm Seeker` — damage to the target player equal to THAT player's hand
// size (not the caster's — Spiraling Embers one pronoun over). D253.

import { STORM_SEEKER } from '../../../data/fixtures/engineCards';
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
  STORM_SEEKER,
  "Storm Seeker deals damage to target player equal to the number of cards in that player's hand.",
);

export const STORM_SEEKER_SCRIPT: CardScript = {
  oracleId: STORM_SEEKER.oracleId,
  name: STORM_SEEKER.name,
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
