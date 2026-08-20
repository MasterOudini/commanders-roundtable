// `Orzhov Cluestone` — the Cluestone cycle's sixth member: mana at #a0
// (engine), the sacrifice-draw the def claims at #a1. D230.

import { ORZHOV_CLUESTONE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  ORZHOV_CLUESTONE,
  '{T}: Add {W} or {B}.\n{W}{B}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ORZHOV_CLUESTONE_SCRIPT: CardScript = {
  oracleId: ORZHOV_CLUESTONE.oracleId,
  name: ORZHOV_CLUESTONE.name,
  activated: [
    {
      ref: `${ORZHOV_CLUESTONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
