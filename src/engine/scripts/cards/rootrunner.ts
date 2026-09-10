// `Rootrunner` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROOTRUNNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROOTRUNNER, "{G}{G}, Sacrifice this creature: Put target land on top of its owner's library.\nSoulshift 3 (When this creature dies, you may return target Spirit card with mana value 3 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put target land on top of its owner's library.", ROOTRUNNER.name);
const VOCAB_T_A0 = vocabularyTargets("Put target land on top of its owner's library.");

export const ROOTRUNNER_SCRIPT: CardScript = {
  oracleId: ROOTRUNNER.oracleId,
  name: ROOTRUNNER.name,
  activated: [
    {
      ref: `${ROOTRUNNER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
