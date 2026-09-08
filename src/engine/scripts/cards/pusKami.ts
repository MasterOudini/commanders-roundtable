// `Pus Kami` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PUS_KAMI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PUS_KAMI, "{B}, Sacrifice this creature: Destroy target nonblack creature.\nSoulshift 6 (When this creature dies, you may return target Spirit card with mana value 6 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target nonblack creature.", PUS_KAMI.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target nonblack creature.");

export const PUS_KAMI_SCRIPT: CardScript = {
  oracleId: PUS_KAMI.oracleId,
  name: PUS_KAMI.name,
  activated: [
    {
      ref: `${PUS_KAMI.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
