// `Kingpin's Enforcers` — "{2}{B}, Sacrifice an artifact or creature: Draw
// a card." The OR-predicate chooser (Ahriman's arms without "another")
// paying in cards. M6.4ab, D184.

import { KINGPIN_S_ENFORCERS } from '../../../data/fixtures/engineCards';
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
  KINGPIN_S_ENFORCERS,
  'Lifelink\n{2}{B}, Sacrifice an artifact or creature: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const KINGPINS_ENFORCERS_SCRIPT: CardScript = {
  oracleId: KINGPIN_S_ENFORCERS.oracleId,
  name: KINGPIN_S_ENFORCERS.name,
  activated: [
    {
      ref: `${KINGPIN_S_ENFORCERS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
