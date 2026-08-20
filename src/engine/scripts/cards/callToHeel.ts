// `Call to Heel` — "Return target creature to its owner's hand. Its
// controller draws a card." The controller is read BEFORE the move (the
// bounce resets it to the owner). D202.

import { CALL_TO_HEEL } from '../../../data/fixtures/engineCards';
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
  CALL_TO_HEEL,
  "Return target creature to its owner's hand. Its controller draws a card.",
);

export const CALL_TO_HEEL_SCRIPT: CardScript = {
  oracleId: CALL_TO_HEEL.oracleId,
  name: CALL_TO_HEEL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      return [
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
        ...drawEvents(ctx.state, controller, 1),
      ];
    },
  },
};
