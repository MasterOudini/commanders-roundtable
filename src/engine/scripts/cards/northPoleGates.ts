// `North Pole Gates` — the Misty Palms shape one color pair over: tapped
// entry (built-in), mana at #a0 (engine), the sacrifice-draw at #a1. D229.

import { NORTH_POLE_GATES } from '../../../data/fixtures/engineCards';
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
  NORTH_POLE_GATES,
  'This land enters tapped.\n{T}: Add {W} or {U}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const NORTH_POLE_GATES_SCRIPT: CardScript = {
  oracleId: NORTH_POLE_GATES.oracleId,
  name: NORTH_POLE_GATES.name,
  activated: [
    {
      ref: `${NORTH_POLE_GATES.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
