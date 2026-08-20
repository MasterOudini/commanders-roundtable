// `Overwhelming Forces` — "Destroy all creatures target opponent controls.
// Draw a card for each creature destroyed this way." The one-player wipe
// counting its OWN kills into draws (Fumigate's count, Kaya's-Wrath's
// side). D231.

import { OVERWHELMING_FORCES } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  OVERWHELMING_FORCES,
  'Destroy all creatures target opponent controls. Draw a card for each creature destroyed this way.',
);

export const OVERWHELMING_FORCES_SCRIPT: CardScript = {
  oracleId: OVERWHELMING_FORCES.oracleId,
  name: OVERWHELMING_FORCES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) {
        events.push({ t: 'CardsMoved', moves });
        const player = ctx.state.players[obj.controller];
        if (player && !player.hasLost) {
          events.push(...drawEvents(ctx.state, obj.controller, moves.length));
        }
      }
      return events;
    },
  },
};
