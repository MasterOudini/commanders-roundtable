// `Selesnya Cluestone` — the sixth Cluestone: mana at a0, the self-sac
// draw the def claims at #a1. D245.

import { SELESNYA_CLUESTONE } from '../../../data/fixtures/engineCards';
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
  SELESNYA_CLUESTONE,
  '{T}: Add {G} or {W}.\n{G}{W}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SELESNYA_CLUESTONE_SCRIPT: CardScript = {
  oracleId: SELESNYA_CLUESTONE.oracleId,
  name: SELESNYA_CLUESTONE.name,
  activated: [
    {
      ref: `${SELESNYA_CLUESTONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
