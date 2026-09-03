// `Peace of Mind` — white mana and a discarded card of my choice (D286) are
// 3 life.

import { PEACE_OF_MIND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PEACE_OF_MIND, '{W}, Discard a card: You gain 3 life.');

export const PEACE_OF_MIND_SCRIPT: CardScript = {
  oracleId: PEACE_OF_MIND.oracleId,
  name: PEACE_OF_MIND.name,
  activated: [
    {
      ref: `${PEACE_OF_MIND.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
