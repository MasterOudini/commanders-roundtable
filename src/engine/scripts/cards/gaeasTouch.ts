// `Gaea's Touch` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GAEA_S_TOUCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GAEA_S_TOUCH, "{0}: You may put a basic Forest card from your hand onto the battlefield. Activate only as a sorcery and only once each turn.\nSacrifice this enchantment: Add {G}{G}.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You may put a basic Forest card from your hand onto the battlefield.", GAEA_S_TOUCH.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a basic Forest card from your hand onto the battlefield.");

export const GAEAS_TOUCH_SCRIPT: CardScript = {
  oracleId: GAEA_S_TOUCH.oracleId,
  name: GAEA_S_TOUCH.name,
  activated: [
    {
      ref: `${GAEA_S_TOUCH.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
