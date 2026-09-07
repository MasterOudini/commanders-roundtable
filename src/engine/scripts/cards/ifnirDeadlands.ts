// `Ifnir Deadlands` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IFNIR_DEADLANDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IFNIR_DEADLANDS, "{T}: Add {C}.\n{T}, Pay 1 life: Add {B}.\n{2}{B}{B}, {T}, Sacrifice a Desert: Put two -1/-1 counters on target creature an opponent controls. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Put two -1/-1 counters on target creature an opponent controls.", IFNIR_DEADLANDS.name);
const VOCAB_T_A2 = vocabularyTargets("Put two -1/-1 counters on target creature an opponent controls.");

export const IFNIR_DEADLANDS_SCRIPT: CardScript = {
  oracleId: IFNIR_DEADLANDS.oracleId,
  name: IFNIR_DEADLANDS.name,
  activated: [
    {
      ref: `${IFNIR_DEADLANDS.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
