// `Airdrop Condor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AIRDROP_CONDOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AIRDROP_CONDOR, "Flying\n{1}{R}, Sacrifice a Goblin creature: This creature deals damage equal to the sacrificed creature's power to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to the sacrificed creature's power to any target.", AIRDROP_CONDOR.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to the sacrificed creature's power to any target.");

export const AIRDROP_CONDOR_SCRIPT: CardScript = {
  oracleId: AIRDROP_CONDOR.oracleId,
  name: AIRDROP_CONDOR.name,
  activated: [
    {
      ref: `${AIRDROP_CONDOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
