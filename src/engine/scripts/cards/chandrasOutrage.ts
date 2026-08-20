// `Chandra's Outrage` — "Chandra's Outrage deals 4 damage to target
// creature and 2 damage to that creature's controller." D203.

import { CHANDRA_S_OUTRAGE } from '../../../data/fixtures/engineCards';
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
  CHANDRA_S_OUTRAGE,
  "Chandra's Outrage deals 4 damage to target creature and 2 damage to that creature's controller.",
);

export const CHANDRAS_OUTRAGE_SCRIPT: CardScript = {
  oracleId: CHANDRA_S_OUTRAGE.oracleId,
  name: CHANDRA_S_OUTRAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const hit = (
        to: { kind: 'card'; id: string } | { kind: 'player'; id: string },
        amount: number,
      ) => ({
        source: self,
        target: to,
        amount,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      return [
        {
          t: 'DamageDealt',
          damages: [
            hit({ kind: 'card', id: target.id }, 4),
            hit({ kind: 'player', id: card.controller }, 2),
          ],
        },
      ];
    },
  },
};
