// `Smash to Smithereens` — Melt Terrain's rider order on an artifact: the
// controller read BEFORE the move, the 3 its own sentence. D249.

import { SMASH_TO_SMITHEREENS } from '../../../data/fixtures/engineCards';
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
  SMASH_TO_SMITHEREENS,
  "Destroy target artifact. Smash to Smithereens deals 3 damage to that artifact's controller.",
);

export const SMASH_TO_SMITHEREENS_SCRIPT: CardScript = {
  oracleId: SMASH_TO_SMITHEREENS.oracleId,
  name: SMASH_TO_SMITHEREENS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
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
            amount: 3,
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
