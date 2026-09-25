// `Overgrown Arch` - an activation gainLife, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OVERGROWN_ARCH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(OVERGROWN_ARCH, "Defender\n{T}: You gain 1 life.\n{2}, Sacrifice this creature: Learn. (You may reveal a Lesson card you own from outside the game and put it into your hand, or discard a card to draw a card.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Learn.", OVERGROWN_ARCH.name);
const VOCAB_T_A1 = vocabularyTargets("Learn.");

export const OVERGROWN_ARCH_SCRIPT: CardScript = {
  oracleId: OVERGROWN_ARCH.oracleId,
  name: OVERGROWN_ARCH.name,
  activated: [
    {
      ref: `${OVERGROWN_ARCH.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
    {
      ref: `${OVERGROWN_ARCH.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
