// `Ghost-Lit Redeemer` - an activation gainLife, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOST_LIT_REDEEMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOST_LIT_REDEEMER, "{W}, {T}: You gain 2 life.\nChannel — {1}{W}, Discard this card: You gain 4 life.");
const LINES = PRINTED.split('\n');

export const GHOST_LIT_REDEEMER_SCRIPT: CardScript = {
  oracleId: GHOST_LIT_REDEEMER.oracleId,
  name: GHOST_LIT_REDEEMER.name,
  activated: [
    {
      ref: `${GHOST_LIT_REDEEMER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
    {
      ref: `${GHOST_LIT_REDEEMER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: me.life + 4 }];
      },
    },
  ],
};
