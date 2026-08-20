// `Melt Terrain` — "Destroy target land. Melt Terrain deals 2 damage to that
// land's controller." Glissa's Scorn's rider order: the controller is read
// BEFORE the move, and the damage is its own sentence, so an indestructible
// land still costs its controller the 2. D224.

import { MELT_TERRAIN } from '../../../data/fixtures/engineCards';
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
  MELT_TERRAIN,
  "Destroy target land. Melt Terrain deals 2 damage to that land's controller.",
);

export const MELT_TERRAIN_SCRIPT: CardScript = {
  oracleId: MELT_TERRAIN.oracleId,
  name: MELT_TERRAIN.name,
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
