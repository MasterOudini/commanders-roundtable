// `Heart Warden` — "{T}: Add {G}.\n{2}, Sacrifice this creature: Draw a
// card." Foggy Bottom Swamp's sacrifice-draw one type over: the mana line is
// the engine's, the def owes line 1, and the sacrifice is the cost batch's
// (D159). M6.4w, D179.

import { HEART_WARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEART_WARDEN, '{T}: Add {G}.\n{2}, Sacrifice this creature: Draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const HEART_WARDEN_SCRIPT: CardScript = {
  oracleId: HEART_WARDEN.oracleId,
  name: HEART_WARDEN.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${HEART_WARDEN.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
