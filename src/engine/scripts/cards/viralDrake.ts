// `Viral Drake` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIRAL_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIRAL_DRAKE, "Flying\nInfect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\n{3}{U}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Proliferate.", VIRAL_DRAKE.name);
const VOCAB_T_A0 = vocabularyTargets("Proliferate.");

export const VIRAL_DRAKE_SCRIPT: CardScript = {
  oracleId: VIRAL_DRAKE.oracleId,
  name: VIRAL_DRAKE.name,
  activated: [
    {
      ref: `${VIRAL_DRAKE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
