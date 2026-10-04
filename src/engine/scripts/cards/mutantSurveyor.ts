// `Mutant Surveyor` - an activation pumping itself, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MUTANT_SURVEYOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MUTANT_SURVEYOR, "Start your engines! (If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.)\n{2}: This creature gets +1/+1 until end of turn.\nMax speed — {3}, Exile this card from your graveyard: Draw a card.");
const LINES = PRINTED.split('\n');

export const MUTANT_SURVEYOR_SCRIPT: CardScript = {
  oracleId: MUTANT_SURVEYOR.oracleId,
  name: MUTANT_SURVEYOR.name,
  activated: [
    {
      ref: `${MUTANT_SURVEYOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
    {
      ref: `${MUTANT_SURVEYOR.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
