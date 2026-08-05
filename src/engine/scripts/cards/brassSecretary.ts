// `Brass Secretary` — "{2}, Sacrifice this creature: Draw a card." Hedron
// Archive's sacrifice-draw on a creature body; no {T}, so no sickness gate.
// M6.4h, D165.

import { BRASS_SECRETARY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BRASS_SECRETARY, '{2}, Sacrifice this creature: Draw a card.');

export const BRASS_SECRETARY_SCRIPT: CardScript = {
  oracleId: BRASS_SECRETARY.oracleId,
  name: BRASS_SECRETARY.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BRASS_SECRETARY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
