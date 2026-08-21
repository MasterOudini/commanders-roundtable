// `Sage of Lat-Nam` — "{T}, Sacrifice an artifact: Draw a card." The
// artifact-predicate chooser paying a draw, behind a tap. D242.

import { SAGE_OF_LAT_NAM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SAGE_OF_LAT_NAM, '{T}, Sacrifice an artifact: Draw a card.');

export const SAGE_OF_LAT_NAM_SCRIPT: CardScript = {
  oracleId: SAGE_OF_LAT_NAM.oracleId,
  name: SAGE_OF_LAT_NAM.name,
  activated: [
    {
      ref: `${SAGE_OF_LAT_NAM.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
