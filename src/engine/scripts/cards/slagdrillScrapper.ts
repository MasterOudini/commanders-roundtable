// `Slagdrill Scrapper` — "{2}, {T}, Sacrifice another artifact or land: Draw
// a card." The OR-predicate chooser with "another": the candidates exclude
// the Scrapper itself, and either arm pays for the draw. D248.

import { SLAGDRILL_SCRAPPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SLAGDRILL_SCRAPPER,
  '{2}, {T}, Sacrifice another artifact or land: Draw a card.',
);

export const SLAGDRILL_SCRAPPER_SCRIPT: CardScript = {
  oracleId: SLAGDRILL_SCRAPPER.oracleId,
  name: SLAGDRILL_SCRAPPER.name,
  activated: [
    {
      ref: `${SLAGDRILL_SCRAPPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
