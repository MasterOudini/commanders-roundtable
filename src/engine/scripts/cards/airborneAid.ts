// `Airborne Aid` — "Draw a card for each Bird on the battlefield." Every
// derived Bird, any controller (the card says so). D197.

import { AIRBORNE_AID } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AIRBORNE_AID, 'Draw a card for each Bird on the battlefield.');

export const AIRBORNE_AID_SCRIPT: CardScript = {
  oracleId: AIRBORNE_AID.oracleId,
  name: AIRBORNE_AID.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let birds = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.derive(id).typeLine.subtypes.includes('Bird')) birds++;
      }
      if (birds === 0) return [];
      return drawEvents(ctx.state, obj.controller, birds);
    },
  },
};
