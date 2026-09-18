// `Deathknell Kami` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEATHKNELL_KAMI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEATHKNELL_KAMI, "Flying\n{2}: This creature gets +1/+1 until end of turn. Sacrifice it at the beginning of the next end step.\nSoulshift 1 (When this creature dies, you may return target Spirit card with mana value 1 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +1/+1 until end of turn. Sacrifice it at the beginning of the next end step.", DEATHKNELL_KAMI.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +1/+1 until end of turn. Sacrifice it at the beginning of the next end step.");

export const DEATHKNELL_KAMI_SCRIPT: CardScript = {
  oracleId: DEATHKNELL_KAMI.oracleId,
  name: DEATHKNELL_KAMI.name,
  activated: [
    {
      ref: `${DEATHKNELL_KAMI.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
