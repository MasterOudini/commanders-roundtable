// `Volrath's Gardens` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOLRATH_S_GARDENS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOLRATH_S_GARDENS, "{2}, Tap an untapped creature you control: You gain 2 life. Activate only as a sorcery.");

export const VOLRATHS_GARDENS_SCRIPT: CardScript = {
  oracleId: VOLRATH_S_GARDENS.oracleId,
  name: VOLRATH_S_GARDENS.name,
  activated: [
    {
      ref: `${VOLRATH_S_GARDENS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
