// `Mind Stone` — "{1}, {T}, Sacrifice this artifact: Draw a card." The
// Commander's Sphere shape with a mana price: the def claims #a1 (the mana
// line is #a0, engine-run), the sacrifice is charged in the cost batch
// (D159), and the resolve is the draw alone. D225.

import { MIND_STONE } from '../../../data/fixtures/engineCards';
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
  MIND_STONE,
  '{T}: Add {C}.\n{1}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MIND_STONE_SCRIPT: CardScript = {
  oracleId: MIND_STONE.oracleId,
  name: MIND_STONE.name,
  activated: [
    {
      ref: `${MIND_STONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
