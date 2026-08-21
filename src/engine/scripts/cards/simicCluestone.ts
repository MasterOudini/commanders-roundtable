// `Simic Cluestone` — the seventh Cluestone: mana at a0, the self-sac
// draw at #a1. D247.

import { SIMIC_CLUESTONE } from '../../../data/fixtures/engineCards';
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
  SIMIC_CLUESTONE,
  '{T}: Add {G} or {U}.\n{G}{U}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SIMIC_CLUESTONE_SCRIPT: CardScript = {
  oracleId: SIMIC_CLUESTONE.oracleId,
  name: SIMIC_CLUESTONE.name,
  activated: [
    {
      ref: `${SIMIC_CLUESTONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
