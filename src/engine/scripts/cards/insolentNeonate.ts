// `Insolent Neonate` — Menace is the engine's; a discarded card of my choice
// (D286) AND the Neonate itself, both in the cost batch, buy a card.

import { INSOLENT_NEONATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  INSOLENT_NEONATE,
  "Menace (This creature can't be blocked except by two or more creatures.)\nDiscard a card, Sacrifice this creature: Draw a card.",
);
const DRAW = PRINTED.split('\n')[1] as string;

export const INSOLENT_NEONATE_SCRIPT: CardScript = {
  oracleId: INSOLENT_NEONATE.oracleId,
  name: INSOLENT_NEONATE.name,
  activated: [
    {
      ref: `${INSOLENT_NEONATE.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
