// `Thallid Soothsayer` — the D168 creature chooser paying for a draw. The
// Soothsayer IS a creature, so it can eat ITSELF (CR 113.7a — the cost is not
// "another") and the ability still resolves. D258.

import { THALLID_SOOTHSAYER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(THALLID_SOOTHSAYER, '{2}, Sacrifice a creature: Draw a card.');

export const THALLID_SOOTHSAYER_SCRIPT: CardScript = {
  oracleId: THALLID_SOOTHSAYER.oracleId,
  name: THALLID_SOOTHSAYER.name,
  activated: [
    {
      ref: `${THALLID_SOOTHSAYER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
