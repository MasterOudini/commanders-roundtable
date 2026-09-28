// `Bonded Herdbeast // Plated Kilnbeast` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BONDED_HERDBEAST_PLATED_KILNBEAST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(BONDED_HERDBEAST_PLATED_KILNBEAST, "{4}{R/P}: Transform this creature. Activate only as a sorcery. ({R/P} can be paid with either {R} or 2 life.)\nMenace (This creature can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", BONDED_HERDBEAST_PLATED_KILNBEAST.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const BONDED_HERDBEAST_PLATED_KILNBEAST_SCRIPT: CardScript = {
  oracleId: BONDED_HERDBEAST_PLATED_KILNBEAST.oracleId,
  name: BONDED_HERDBEAST_PLATED_KILNBEAST.name,
  activated: [
    {
      ref: `${BONDED_HERDBEAST_PLATED_KILNBEAST.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
