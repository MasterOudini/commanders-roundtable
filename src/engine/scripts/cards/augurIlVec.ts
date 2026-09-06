// `Augur il-Vec` - an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AUGUR_IL_VEC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AUGUR_IL_VEC, "Shadow (This creature can block or be blocked by only creatures with shadow.)\nSacrifice this creature: You gain 4 life. Activate only during your upkeep.");
const LINES = PRINTED.split('\n');

export const AUGUR_IL_VEC_SCRIPT: CardScript = {
  oracleId: AUGUR_IL_VEC.oracleId,
  name: AUGUR_IL_VEC.name,
  activated: [
    {
      ref: `${AUGUR_IL_VEC.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
      },
    },
  ],
};
