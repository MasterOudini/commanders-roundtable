// `Selhoff Entomber` — the tap and a discarded CREATURE card of my choice
// (the D286 chooser with a typed predicate) buy a card.

import { SELHOFF_ENTOMBER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SELHOFF_ENTOMBER, '{T}, Discard a creature card: Draw a card.');

export const SELHOFF_ENTOMBER_SCRIPT: CardScript = {
  oracleId: SELHOFF_ENTOMBER.oracleId,
  name: SELHOFF_ENTOMBER.name,
  activated: [
    {
      ref: `${SELHOFF_ENTOMBER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
