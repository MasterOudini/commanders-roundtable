// `Sawtooth Thresher` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAWTOOTH_THRESHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAWTOOTH_THRESHER, "Sunburst (This creature enters with a +1/+1 counter on it for each color of mana spent to cast it.)\nRemove two +1/+1 counters from this creature: It gets +4/+4 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("It gets +4/+4 until end of turn.", SAWTOOTH_THRESHER.name);
const VOCAB_T_A0 = vocabularyTargets("It gets +4/+4 until end of turn.");

export const SAWTOOTH_THRESHER_SCRIPT: CardScript = {
  oracleId: SAWTOOTH_THRESHER.oracleId,
  name: SAWTOOTH_THRESHER.name,
  activated: [
    {
      ref: `${SAWTOOTH_THRESHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
