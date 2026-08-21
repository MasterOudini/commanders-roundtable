// `Selesnya Locket` — the Locket: mana at a0, the hybrid-priced self-sac
// draw-two at #a1. D245.

import { SELESNYA_LOCKET } from '../../../data/fixtures/engineCards';
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
  SELESNYA_LOCKET,
  '{T}: Add {G} or {W}.\n{G/W}{G/W}{G/W}{G/W}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SELESNYA_LOCKET_SCRIPT: CardScript = {
  oracleId: SELESNYA_LOCKET.oracleId,
  name: SELESNYA_LOCKET.name,
  activated: [
    {
      ref: `${SELESNYA_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 2)];
      },
    },
  ],
};
