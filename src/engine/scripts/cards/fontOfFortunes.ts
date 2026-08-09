// `Font of Fortunes` — "{1}{U}, Sacrifice this enchantment: Draw two
// cards." The sacrifice-draw on an ENCHANTMENT body. M6.4s, D175.

import { FONT_OF_FORTUNES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FONT_OF_FORTUNES, '{1}{U}, Sacrifice this enchantment: Draw two cards.');

export const FONT_OF_FORTUNES_SCRIPT: CardScript = {
  oracleId: FONT_OF_FORTUNES.oracleId,
  name: FONT_OF_FORTUNES.name,
  activated: [
    {
      ref: `${FONT_OF_FORTUNES.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
