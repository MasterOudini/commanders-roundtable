// `Slinking Skirge` — "{2}, Sacrifice this creature: Draw a card." The
// self-sac draw with no tap: the keyword line never counts. D249.

import { SLINKING_SKIRGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLINKING_SKIRGE, 'Flying\n{2}, Sacrifice this creature: Draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const SLINKING_SKIRGE_SCRIPT: CardScript = {
  oracleId: SLINKING_SKIRGE.oracleId,
  name: SLINKING_SKIRGE.name,
  activated: [
    {
      ref: `${SLINKING_SKIRGE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
