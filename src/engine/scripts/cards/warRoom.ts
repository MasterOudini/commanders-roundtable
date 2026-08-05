// `War Room` — Land, "{T}: Add {C}.\n{3}, {T}, Pay life equal to the number of
// colors in your commanders' color identity: Draw a card." — the first
// COMPUTED cost (M6.4b, D159). The parse records the RULE
// (`lifeCostCommanderColors`), and the activation reads the number off the
// player's identity — 3 under Kess, 1 under Krenko, 0 with a colourless
// commander — so the payment review, the wire and the log all carry the real
// price. The def owes only the draw.

import { WAR_ROOM } from '../../../data/fixtures/engineCards';
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
  WAR_ROOM,
  "{T}: Add {C}.\n{3}, {T}, Pay life equal to the number of colors in your commanders' color identity: Draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const WAR_ROOM_SCRIPT: CardScript = {
  oracleId: WAR_ROOM.oracleId,
  name: WAR_ROOM.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${WAR_ROOM.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
