// `Consign to the Pit` — "Destroy target creature. Consign to the Pit
// deals 2 damage to that creature's controller." The controller read
// BEFORE the move; the burn is the SPELL's, so it lands even though the
// creature is already gone — but not if indestructible spared it (the
// destroy failing forfeits nothing further; the burn clause is
// unconditional per the printed text, so it fires either way). D204.

import { CONSIGN_TO_THE_PIT } from '../../../data/fixtures/engineCards';
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
  CONSIGN_TO_THE_PIT,
  "Destroy target creature. Consign to the Pit deals 2 damage to that creature's controller.",
);

export const CONSIGN_TO_THE_PIT_SCRIPT: CardScript = {
  oracleId: CONSIGN_TO_THE_PIT.oracleId,
  name: CONSIGN_TO_THE_PIT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      events.push({
        t: 'DamageDealt',
        damages: [
          {
            source: self,
            target: { kind: 'player', id: controller },
            amount: 2,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal',
          },
        ],
      });
      return events;
    },
  },
};
