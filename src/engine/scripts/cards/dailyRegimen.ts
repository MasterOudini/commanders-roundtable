// `Daily Regimen` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAILY_REGIMEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAILY_REGIMEN, "Enchant creature\n{1}{W}: Put a +1/+1 counter on enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on enchanted creature.", DAILY_REGIMEN.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on enchanted creature.");

export const DAILY_REGIMEN_SCRIPT: CardScript = {
  oracleId: DAILY_REGIMEN.oracleId,
  name: DAILY_REGIMEN.name,
  activated: [
    {
      ref: `${DAILY_REGIMEN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
