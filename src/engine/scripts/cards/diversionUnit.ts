// `Diversion Unit` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIVERSION_UNIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIVERSION_UNIT, "Flying\n{U}, Sacrifice this creature: Counter target instant or sorcery spell unless its controller pays {3}.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Counter target instant or sorcery spell unless its controller pays {3}.", DIVERSION_UNIT.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target instant or sorcery spell unless its controller pays {3}.");

export const DIVERSION_UNIT_SCRIPT: CardScript = {
  oracleId: DIVERSION_UNIT.oracleId,
  name: DIVERSION_UNIT.name,
  activated: [
    {
      ref: `${DIVERSION_UNIT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
