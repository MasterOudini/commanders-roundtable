// `Avengers Tower` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVENGERS_TOWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVENGERS_TOWER, "{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a Hero spell or to activate an ability of a Hero source.\n{4}, {T}: Look at the top three cards of your library. You may reveal a Hero card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Look at the top three cards of your library. You may reveal a Hero card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", AVENGERS_TOWER.name);
const VOCAB_T_A2 = vocabularyTargets("Look at the top three cards of your library. You may reveal a Hero card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

export const AVENGERS_TOWER_SCRIPT: CardScript = {
  oracleId: AVENGERS_TOWER.oracleId,
  name: AVENGERS_TOWER.name,
  activated: [
    {
      ref: `${AVENGERS_TOWER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
