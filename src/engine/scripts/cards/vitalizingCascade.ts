// `Vitalizing Cascade` — gain X plus 3, so X=0 still gains 3. The floor is
// what makes it never a no-op, which is the branch worth pinning. D266.

import { VITALIZING_CASCADE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VITALIZING_CASCADE, 'You gain X plus 3 life.');

export const VITALIZING_CASCADE_SCRIPT: CardScript = {
  oracleId: VITALIZING_CASCADE.oracleId,
  name: VITALIZING_CASCADE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const amount = (obj.xValue ?? 0) + 3;
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: amount, to: me.life + amount }];
    },
  },
};
