// `Oscorp Research Team` — "{6}{U}: Draw two cards." Mystic
// Archaeologist's repeatable draw at a bigger price. D231.

import { OSCORP_RESEARCH_TEAM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(OSCORP_RESEARCH_TEAM, '{6}{U}: Draw two cards.');

export const OSCORP_RESEARCH_TEAM_SCRIPT: CardScript = {
  oracleId: OSCORP_RESEARCH_TEAM.oracleId,
  name: OSCORP_RESEARCH_TEAM.name,
  activated: [
    {
      ref: `${OSCORP_RESEARCH_TEAM.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 2)];
      },
    },
  ],
};
