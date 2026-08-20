// `Misty Palms Oasis` — the Foggy Bottom Swamp shape one wording over:
// tapped entry (built-in), the mana line at #a0 (engine), and the
// sacrifice-draw the def claims at #a1. D225.

import { MISTY_PALMS_OASIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  MISTY_PALMS_OASIS,
  'This land enters tapped.\n{T}: Add {W} or {B}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const MISTY_PALMS_OASIS_SCRIPT: CardScript = {
  oracleId: MISTY_PALMS_OASIS.oracleId,
  name: MISTY_PALMS_OASIS.name,
  activated: [
    {
      ref: `${MISTY_PALMS_OASIS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
