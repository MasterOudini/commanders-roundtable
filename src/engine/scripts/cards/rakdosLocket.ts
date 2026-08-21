// `Rakdos Locket` — the sixth Locket: "{B/R}{B/R}{B/R}{B/R}, {T},
// Sacrifice this artifact: Draw two cards." D237.

import { RAKDOS_LOCKET } from '../../../data/fixtures/engineCards';
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
  RAKDOS_LOCKET,
  '{T}: Add {B} or {R}.\n{B/R}{B/R}{B/R}{B/R}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const RAKDOS_LOCKET_SCRIPT: CardScript = {
  oracleId: RAKDOS_LOCKET.oracleId,
  name: RAKDOS_LOCKET.name,
  activated: [
    {
      ref: `${RAKDOS_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 2)];
      },
    },
  ],
};
