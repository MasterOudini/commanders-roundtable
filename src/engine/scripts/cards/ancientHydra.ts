// `Ancient Hydra` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANCIENT_HYDRA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANCIENT_HYDRA, "Fading 5 (This creature enters with five fade counters on it. At the beginning of your upkeep, remove a fade counter from it. If you can't, sacrifice it.)\n{1}, Remove a fade counter from this creature: It deals 1 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("It deals 1 damage to any target.", ANCIENT_HYDRA.name);
const VOCAB_T_A0 = vocabularyTargets("It deals 1 damage to any target.");

export const ANCIENT_HYDRA_SCRIPT: CardScript = {
  oracleId: ANCIENT_HYDRA.oracleId,
  name: ANCIENT_HYDRA.name,
  activated: [
    {
      ref: `${ANCIENT_HYDRA.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
