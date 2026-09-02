// `Zarichi Tiger` — "{1}{W}, {T}: You gain 2 life." D271.

import { ZARICHI_TIGER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ZARICHI_TIGER, '{1}{W}, {T}: You gain 2 life.');

export const ZARICHI_TIGER_SCRIPT: CardScript = {
  oracleId: ZARICHI_TIGER.oracleId,
  name: ZARICHI_TIGER.name,
  activated: [
    {
      ref: `${ZARICHI_TIGER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
