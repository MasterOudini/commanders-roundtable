// `Kjeldoran Javelineer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KJELDORAN_JAVELINEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KJELDORAN_JAVELINEER, "Cumulative upkeep {1} (At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.)\n{T}: This creature deals damage equal to the number of age counters on it to target attacking or blocking creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to the number of age counters on it to target attacking or blocking creature.", KJELDORAN_JAVELINEER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to the number of age counters on it to target attacking or blocking creature.");

export const KJELDORAN_JAVELINEER_SCRIPT: CardScript = {
  oracleId: KJELDORAN_JAVELINEER.oracleId,
  name: KJELDORAN_JAVELINEER.name,
  activated: [
    {
      ref: `${KJELDORAN_JAVELINEER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
