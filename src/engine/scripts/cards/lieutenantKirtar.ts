// `Lieutenant Kirtar` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIEUTENANT_KIRTAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIEUTENANT_KIRTAR, "Flying\n{1}{W}, Sacrifice Lieutenant Kirtar: Exile target attacking creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile target attacking creature.", LIEUTENANT_KIRTAR.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target attacking creature.");

export const LIEUTENANT_KIRTAR_SCRIPT: CardScript = {
  oracleId: LIEUTENANT_KIRTAR.oracleId,
  name: LIEUTENANT_KIRTAR.name,
  activated: [
    {
      ref: `${LIEUTENANT_KIRTAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
