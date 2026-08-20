// `Filigree Fracture` — "Destroy target artifact or enchantment. If that
// permanent was blue or black, draw a card." The color is read pre-move
// off the DERIVED characteristics; the draw is tied to the permanent
// (Certain Death's precedent). D213.

import { FILIGREE_FRACTURE } from '../../../data/fixtures/engineCards';
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
  FILIGREE_FRACTURE,
  'Destroy target artifact or enchantment. If that permanent was blue or black, draw a card.',
);

export const FILIGREE_FRACTURE_SCRIPT: CardScript = {
  oracleId: FILIGREE_FRACTURE.oracleId,
  name: FILIGREE_FRACTURE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const wasBlueOrBlack = d.colors.includes('U') || d.colors.includes('B');
      const events: EventBody[] = [];
      if (!d.keywords.has('indestructible')) {
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
      if (wasBlueOrBlack) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
