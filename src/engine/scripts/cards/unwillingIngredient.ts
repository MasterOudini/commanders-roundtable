// `Unwilling Ingredient` - an activation drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNWILLING_INGREDIENT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(UNWILLING_INGREDIENT, "Menace (This creature can't be blocked except by two or more creatures.)\n{2}{B}, Exile this card from your graveyard: You draw a card and you lose 1 life.");
const LINES = PRINTED.split('\n');

export const UNWILLING_INGREDIENT_SCRIPT: CardScript = {
  oracleId: UNWILLING_INGREDIENT.oracleId,
  name: UNWILLING_INGREDIENT.name,
  activated: [
    {
      ref: `${UNWILLING_INGREDIENT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
