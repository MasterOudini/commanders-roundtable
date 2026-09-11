// `Ghitu Encampment` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHITU_ENCAMPMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHITU_ENCAMPMENT, "This land enters tapped.\n{T}: Add {R}.\n{1}{R}: This land becomes a 2/1 red Warrior creature with first strike until end of turn. It's still a land. (It deals combat damage before creatures without first strike.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/1 red Warrior creature with first strike until end of turn. It's still a land.", GHITU_ENCAMPMENT.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/1 red Warrior creature with first strike until end of turn. It's still a land.");

export const GHITU_ENCAMPMENT_SCRIPT: CardScript = {
  oracleId: GHITU_ENCAMPMENT.oracleId,
  name: GHITU_ENCAMPMENT.name,
  activated: [
    {
      ref: `${GHITU_ENCAMPMENT.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
