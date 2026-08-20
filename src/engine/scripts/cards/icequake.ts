// `Icequake` — destroy the land; the 1 damage rider only if it WAS a
// snow land (derived supertypes, read pre-move). D219.

import { ICEQUAKE } from '../../../data/fixtures/engineCards';
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
  ICEQUAKE,
  "Destroy target land. If that land was a snow land, Icequake deals 1 damage to that land's controller.",
);

export const ICEQUAKE_SCRIPT: CardScript = {
  oracleId: ICEQUAKE.oracleId,
  name: ICEQUAKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const wasSnow = d.typeLine.supertypes.includes('Snow');
      const controller = card.controller;
      const events: EventBody[] = [];
      if (!d.keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      if (wasSnow && !ctx.state.players[controller]?.hasLost) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: controller },
              amount: 1,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return events;
    },
  },
};
