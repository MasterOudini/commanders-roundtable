// `Ravenous Amulet` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVENOUS_AMULET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVENOUS_AMULET, "{1}, {T}, Sacrifice a creature: Draw a card and put a soul counter on this artifact. Activate only as a sorcery.\n{4}, {T}, Sacrifice this artifact: Each opponent loses life equal to the number of soul counters on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Draw a card and put a soul counter on ~.", RAVENOUS_AMULET.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card and put a soul counter on ~.");
const VOCAB_A1 = vocabularyEffects("Each opponent loses life equal to the number of soul counters on ~.", RAVENOUS_AMULET.name);
const VOCAB_T_A1 = vocabularyTargets("Each opponent loses life equal to the number of soul counters on ~.");

export const RAVENOUS_AMULET_SCRIPT: CardScript = {
  oracleId: RAVENOUS_AMULET.oracleId,
  name: RAVENOUS_AMULET.name,
  activated: [
    {
      ref: `${RAVENOUS_AMULET.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${RAVENOUS_AMULET.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
