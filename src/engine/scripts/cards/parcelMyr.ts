// `Parcel Myr` — "{2}, Sacrifice this creature: Draw a card." D232.

import { PARCEL_MYR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PARCEL_MYR, '{2}, Sacrifice this creature: Draw a card.');

export const PARCEL_MYR_SCRIPT: CardScript = {
  oracleId: PARCEL_MYR.oracleId,
  name: PARCEL_MYR.name,
  activated: [
    {
      ref: `${PARCEL_MYR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
