// `Scepter of Insight` — "{3}{U}, {T}: Draw a card." The paid tap-draw
// on an artifact. D244.

import { SCEPTER_OF_INSIGHT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SCEPTER_OF_INSIGHT, '{3}{U}, {T}: Draw a card.');

export const SCEPTER_OF_INSIGHT_SCRIPT: CardScript = {
  oracleId: SCEPTER_OF_INSIGHT.oracleId,
  name: SCEPTER_OF_INSIGHT.name,
  activated: [
    {
      ref: `${SCEPTER_OF_INSIGHT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
