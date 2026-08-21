// `Serpent's Pass` — the three-line land: tapped built-in, the engine's
// mana line, the self-sac draw the def claims at #a1 (TEXT = split[2]).
// D246.

import { SERPENT_S_PASS } from '../../../data/fixtures/engineCards';
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
  SERPENT_S_PASS,
  'This land enters tapped.\n{T}: Add {U} or {B}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SERPENTS_PASS_SCRIPT: CardScript = {
  oracleId: SERPENT_S_PASS.oracleId,
  name: SERPENT_S_PASS.name,
  activated: [
    {
      ref: `${SERPENT_S_PASS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
