// `Nomad Stadium` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NOMAD_STADIUM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NOMAD_STADIUM, "{T}: Add {W}. This land deals 1 damage to you.\nThreshold — {W}, {T}, Sacrifice this land: You gain 4 life. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

export const NOMAD_STADIUM_SCRIPT: CardScript = {
  oracleId: NOMAD_STADIUM.oracleId,
  name: NOMAD_STADIUM.name,
  activated: [
    {
      ref: `${NOMAD_STADIUM.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
      },
    },
  ],
};
