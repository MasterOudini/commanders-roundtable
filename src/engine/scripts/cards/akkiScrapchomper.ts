// `Akki Scrapchomper` — "{1}{R}, {T}, Sacrifice an artifact or land: Draw a
// card." The chooser's OR-predicate (Ahriman's) with a tap in the cost and
// no target — one of the two freed cards D168 lands as-is. M6.4l, D169.

import { AKKI_SCRAPCHOMPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AKKI_SCRAPCHOMPER, '{1}{R}, {T}, Sacrifice an artifact or land: Draw a card.');

export const AKKI_SCRAPCHOMPER_SCRIPT: CardScript = {
  oracleId: AKKI_SCRAPCHOMPER.oracleId,
  name: AKKI_SCRAPCHOMPER.name,
  activated: [
    {
      ref: `${AKKI_SCRAPCHOMPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
