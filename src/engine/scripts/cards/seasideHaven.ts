// `Seaside Haven` — "{T}: Add {C}. / {W}{U}, {T}, Sacrifice a Bird: Draw
// a card." The Bird-predicate chooser paying a draw at #a1 behind the
// mana line. D245.

import { SEASIDE_HAVEN } from '../../../data/fixtures/engineCards';
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
  SEASIDE_HAVEN,
  '{T}: Add {C}.\n{W}{U}, {T}, Sacrifice a Bird: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SEASIDE_HAVEN_SCRIPT: CardScript = {
  oracleId: SEASIDE_HAVEN.oracleId,
  name: SEASIDE_HAVEN.name,
  activated: [
    {
      ref: `${SEASIDE_HAVEN.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
