// `Hellkite Igniter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HELLKITE_IGNITER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HELLKITE_IGNITER, "Flying, haste\n{1}{R}: This creature gets +X/+0 until end of turn, where X is the number of artifacts you control.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +X/+0 until end of turn, where X is the number of artifacts you control.", HELLKITE_IGNITER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +X/+0 until end of turn, where X is the number of artifacts you control.");

export const HELLKITE_IGNITER_SCRIPT: CardScript = {
  oracleId: HELLKITE_IGNITER.oracleId,
  name: HELLKITE_IGNITER.name,
  activated: [
    {
      ref: `${HELLKITE_IGNITER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
