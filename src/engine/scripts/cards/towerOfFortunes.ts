// `Tower of Fortunes` — the {8}, {T} cycle's draw, and the largest of the
// four payloads. Four cards through THE one draw rule, empty-library loss
// included (D158). D261.

import { TOWER_OF_FORTUNES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TOWER_OF_FORTUNES, '{8}, {T}: Draw four cards.');

export const TOWER_OF_FORTUNES_SCRIPT: CardScript = {
  oracleId: TOWER_OF_FORTUNES.oracleId,
  name: TOWER_OF_FORTUNES.name,
  activated: [
    {
      ref: `${TOWER_OF_FORTUNES.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 4),
    },
  ],
};
