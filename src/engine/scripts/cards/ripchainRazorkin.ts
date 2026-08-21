// `Ripchain Razorkin` — "Reach / {2}{R}, Sacrifice a land: Draw a card."
// The land-predicate chooser (D168) paying for a draw; the keyword line
// never counts, so the ability is #a0. D240.

import { RIPCHAIN_RAZORKIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIPCHAIN_RAZORKIN, 'Reach\n{2}{R}, Sacrifice a land: Draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const RIPCHAIN_RAZORKIN_SCRIPT: CardScript = {
  oracleId: RIPCHAIN_RAZORKIN.oracleId,
  name: RIPCHAIN_RAZORKIN.name,
  activated: [
    {
      ref: `${RIPCHAIN_RAZORKIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
