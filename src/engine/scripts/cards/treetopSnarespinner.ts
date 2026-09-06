// `Treetop Snarespinner` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TREETOP_SNARESPINNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TREETOP_SNARESPINNER, "Reach (This creature can block creatures with flying.)\nDeathtouch (Any amount of damage this deals to a creature is enough to destroy it.)\n{2}{G}: Put a +1/+1 counter on target creature you control. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on target creature you control.", TREETOP_SNARESPINNER.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on target creature you control.");

export const TREETOP_SNARESPINNER_SCRIPT: CardScript = {
  oracleId: TREETOP_SNARESPINNER.oracleId,
  name: TREETOP_SNARESPINNER.name,
  activated: [
    {
      ref: `${TREETOP_SNARESPINNER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
