// `Temur Banner` — the FOURTH Banner. The mana line is the engine's (ability
// 0); this def claims the sac-draw at #a1. D258.

import { TEMUR_BANNER } from '../../../data/fixtures/engineCards';
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
  TEMUR_BANNER,
  '{T}: Add {G}, {U}, or {R}.\n{G}{U}{R}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TEMUR_BANNER_SCRIPT: CardScript = {
  oracleId: TEMUR_BANNER.oracleId,
  name: TEMUR_BANNER.name,
  activated: [
    {
      ref: `${TEMUR_BANNER.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
