// `Alchemist's Apprentice` — "Sacrifice this creature: Draw a card." A cost
// that is NOTHING BUT the self-sacrifice — no mana, no tap — which makes it
// the cleanest proof that the sacrifice alone is a chargeable price (M6.4c,
// D160). Its resolve runs with the Apprentice already in the graveyard.

import { ALCHEMIST_S_APPRENTICE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ALCHEMIST_S_APPRENTICE, 'Sacrifice this creature: Draw a card.');

export const ALCHEMISTS_APPRENTICE_SCRIPT: CardScript = {
  oracleId: ALCHEMIST_S_APPRENTICE.oracleId,
  name: ALCHEMIST_S_APPRENTICE.name,
  activated: [
    {
      ref: `${ALCHEMIST_S_APPRENTICE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
