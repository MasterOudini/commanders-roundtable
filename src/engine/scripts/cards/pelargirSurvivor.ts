// `Pelargir Survivor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PELARGIR_SURVIVOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PELARGIR_SURVIVOR, "{T}: Add one mana of any color. Spend this mana only to cast an instant or sorcery spell.\n{5}{U}, {T}: Target player mills three cards. (They put the top three cards of their library into their graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target player mills three cards.", PELARGIR_SURVIVOR.name);
const VOCAB_T_A1 = vocabularyTargets("Target player mills three cards.");

export const PELARGIR_SURVIVOR_SCRIPT: CardScript = {
  oracleId: PELARGIR_SURVIVOR.oracleId,
  name: PELARGIR_SURVIVOR.name,
  activated: [
    {
      ref: `${PELARGIR_SURVIVOR.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
