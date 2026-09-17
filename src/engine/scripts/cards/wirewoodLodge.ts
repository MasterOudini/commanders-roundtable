// `Wirewood Lodge` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WIREWOOD_LODGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WIREWOOD_LODGE, "{T}: Add {C}.\n{G}, {T}: Untap target Elf.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Untap target Elf.", WIREWOOD_LODGE.name);
const VOCAB_T_A1 = vocabularyTargets("Untap target Elf.");

export const WIREWOOD_LODGE_SCRIPT: CardScript = {
  oracleId: WIREWOOD_LODGE.oracleId,
  name: WIREWOOD_LODGE.name,
  activated: [
    {
      ref: `${WIREWOOD_LODGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
