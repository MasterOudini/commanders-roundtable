// `Temporal Machinations` — the bounce with an artifact-conditioned draw.
// Break the Spell's shape (D201): the condition is read BEFORE the move, so
// bouncing an artifact creature of my own still pays — but the condition
// here is about what I CONTROL, and the target is anyone's. D257.

import { TEMPORAL_MACHINATIONS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  TEMPORAL_MACHINATIONS,
  "Return target creature to its owner's hand. If you control an artifact, draw a card.",
);

export const TEMPORAL_MACHINATIONS_SCRIPT: CardScript = {
  oracleId: TEMPORAL_MACHINATIONS.oracleId,
  name: TEMPORAL_MACHINATIONS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      // Read the board BEFORE the bounce: an artifact creature being returned
      // is still mine to count at this instant.
      let artifact = false;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) {
          artifact = true;
          break;
        }
      }
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
      if (!artifact) return events;
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return events;
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
