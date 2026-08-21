// `Sultai Banner` — the THIRD Banner: three-colour mana at a0, the
// self-sac draw the def claims at #a1. D255.

import { SULTAI_BANNER } from '../../../data/fixtures/engineCards';
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
  SULTAI_BANNER,
  '{T}: Add {B}, {G}, or {U}.\n{B}{G}{U}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SULTAI_BANNER_SCRIPT: CardScript = {
  oracleId: SULTAI_BANNER.oracleId,
  name: SULTAI_BANNER.name,
  activated: [
    {
      ref: `${SULTAI_BANNER.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
