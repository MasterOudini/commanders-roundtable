// `Teferi's Honor Guard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEFERI_S_HONOR_GUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEFERI_S_HONOR_GUARD, "Flanking (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)\n{U}{U}: This creature phases out. (While it's phased out, it's treated as though it doesn't exist. It phases in before you untap during your next untap step.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ phases out.", TEFERI_S_HONOR_GUARD.name);
const VOCAB_T_A0 = vocabularyTargets("~ phases out.");

export const TEFERIS_HONOR_GUARD_SCRIPT: CardScript = {
  oracleId: TEFERI_S_HONOR_GUARD.oracleId,
  name: TEFERI_S_HONOR_GUARD.name,
  activated: [
    {
      ref: `${TEFERI_S_HONOR_GUARD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
