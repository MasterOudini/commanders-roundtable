// `Acolyte of Aclazotz` - an activation drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ACOLYTE_OF_ACLAZOTZ } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACOLYTE_OF_ACLAZOTZ, "{T}, Sacrifice another creature or artifact: Each opponent loses 1 life and you gain 1 life.");

export const ACOLYTE_OF_ACLAZOTZ_SCRIPT: CardScript = {
  oracleId: ACOLYTE_OF_ACLAZOTZ.oracleId,
  name: ACOLYTE_OF_ACLAZOTZ.name,
  activated: [
    {
      ref: `${ACOLYTE_OF_ACLAZOTZ.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 });
        return out;
      },
    },
  ],
};
