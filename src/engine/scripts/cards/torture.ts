// `Torture` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TORTURE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TORTURE, "Enchant creature\n{1}{B}: Put a -1/-1 counter on enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a -1/-1 counter on enchanted creature.", TORTURE.name);
const VOCAB_T_A0 = vocabularyTargets("Put a -1/-1 counter on enchanted creature.");

export const TORTURE_SCRIPT: CardScript = {
  oracleId: TORTURE.oracleId,
  name: TORTURE.name,
  activated: [
    {
      ref: `${TORTURE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
