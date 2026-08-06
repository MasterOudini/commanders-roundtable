// `Cephalid Scout` — "Flying\n{2}{U}, Sacrifice a land: Draw a card." The
// chooser's land predicate, no tap, no target — the second freed card D168
// lands as-is. The keyword line has no colon, so the ability is index 0.
// M6.4l, D169.

import { CEPHALID_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CEPHALID_SCOUT, 'Flying\n{2}{U}, Sacrifice a land: Draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const CEPHALID_SCOUT_SCRIPT: CardScript = {
  oracleId: CEPHALID_SCOUT.oracleId,
  name: CEPHALID_SCOUT.name,
  activated: [
    {
      ref: `${CEPHALID_SCOUT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
