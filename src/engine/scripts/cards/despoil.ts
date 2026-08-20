// `Despoil` — "Destroy target land. Its controller loses 2 life." The
// controller is read BEFORE the move; an indestructible land keeps its
// controller's life too — the loss names the destroyed land's controller,
// and Certain Death's precedent (D206) reads the rider as independent of
// the destruction only where the words say so. Here "its controller" still
// refers to the land whether or not it dies, so the loss lands either way.
// D208.

import { DESPOIL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DESPOIL, 'Destroy target land. Its controller loses 2 life.');

export const DESPOIL_SCRIPT: CardScript = {
  oracleId: DESPOIL.oracleId,
  name: DESPOIL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
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
      const p = ctx.state.players[controller];
      if (p && !p.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: -2, to: p.life - 2 });
      }
      return events;
    },
  },
};
