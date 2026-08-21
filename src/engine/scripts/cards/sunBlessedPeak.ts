// `Sun-Blessed Peak` — the three-line self-sac draw land (TEXT = split[2]).
// D255.

import { SUN_BLESSED_PEAK } from '../../../data/fixtures/engineCards';
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
  SUN_BLESSED_PEAK,
  'This land enters tapped.\n{T}: Add {R} or {W}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SUN_BLESSED_PEAK_SCRIPT: CardScript = {
  oracleId: SUN_BLESSED_PEAK.oracleId,
  name: SUN_BLESSED_PEAK.name,
  activated: [
    {
      ref: `${SUN_BLESSED_PEAK.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
