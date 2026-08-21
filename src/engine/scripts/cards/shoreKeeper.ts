// `Shore Keeper` — "{7}{U}, {T}, Sacrifice this creature: Draw three
// cards." The big self-sac draw. D246.

import { SHORE_KEEPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SHORE_KEEPER, '{7}{U}, {T}, Sacrifice this creature: Draw three cards.');

export const SHORE_KEEPER_SCRIPT: CardScript = {
  oracleId: SHORE_KEEPER.oracleId,
  name: SHORE_KEEPER.name,
  activated: [
    {
      ref: `${SHORE_KEEPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 3)];
      },
    },
  ],
};
