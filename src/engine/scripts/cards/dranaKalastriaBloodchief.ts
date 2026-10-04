// `Drana, Kalastria Bloodchief` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRANA_KALASTRIA_BLOODCHIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRANA_KALASTRIA_BLOODCHIEF, "Flying\n{X}{B}{B}: Target creature gets -0/-X until end of turn and Drana gets +X/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature gets -0/-X until end of turn and ~ gets +X/+0 until end of turn.", DRANA_KALASTRIA_BLOODCHIEF.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Target creature gets -0/-X until end of turn and ~ gets +X/+0 until end of turn.");

export const DRANA_KALASTRIA_BLOODCHIEF_SCRIPT: CardScript = {
  oracleId: DRANA_KALASTRIA_BLOODCHIEF.oracleId,
  name: DRANA_KALASTRIA_BLOODCHIEF.name,
  activated: [
    {
      ref: `${DRANA_KALASTRIA_BLOODCHIEF.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
