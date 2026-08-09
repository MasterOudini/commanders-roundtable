// `Font of Vigor` — "{2}{W}, Sacrifice this enchantment: You gain 7 life."
// M6.4s, D175.

import { FONT_OF_VIGOR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FONT_OF_VIGOR, '{2}{W}, Sacrifice this enchantment: You gain 7 life.');

export const FONT_OF_VIGOR_SCRIPT: CardScript = {
  oracleId: FONT_OF_VIGOR.oracleId,
  name: FONT_OF_VIGOR.name,
  activated: [
    {
      ref: `${FONT_OF_VIGOR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 7, to: player.life + 7 }];
      },
    },
  ],
};
