// `Goblin Rimerunner` - an activation vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_RIMERUNNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_RIMERUNNER, "{T}: Target creature can't block this turn.\n{S}: This creature gains haste until end of turn. ({S} can be paid with one mana from a snow source.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", GOBLIN_RIMERUNNER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const GOBLIN_RIMERUNNER_SCRIPT: CardScript = {
  oracleId: GOBLIN_RIMERUNNER.oracleId,
  name: GOBLIN_RIMERUNNER.name,
  activated: [
    {
      ref: `${GOBLIN_RIMERUNNER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${GOBLIN_RIMERUNNER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
  ],
};
