// `Potioner's Trove` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POTIONER_S_TROVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POTIONER_S_TROVE, "{T}: Add one mana of any color.\n{T}: You gain 2 life. Activate only if you've cast an instant or sorcery spell this turn.");
const LINES = PRINTED.split('\n');

export const POTIONERS_TROVE_SCRIPT: CardScript = {
  oracleId: POTIONER_S_TROVE.oracleId,
  name: POTIONER_S_TROVE.name,
  activated: [
    {
      ref: `${POTIONER_S_TROVE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
