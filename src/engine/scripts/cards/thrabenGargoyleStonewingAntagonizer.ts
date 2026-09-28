// `Thraben Gargoyle // Stonewing Antagonizer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRABEN_GARGOYLE_STONEWING_ANTAGONIZER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THRABEN_GARGOYLE_STONEWING_ANTAGONIZER, "Defender\n{6}: Transform this creature.\nFlying");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", THRABEN_GARGOYLE_STONEWING_ANTAGONIZER.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const THRABEN_GARGOYLE_STONEWING_ANTAGONIZER_SCRIPT: CardScript = {
  oracleId: THRABEN_GARGOYLE_STONEWING_ANTAGONIZER.oracleId,
  name: THRABEN_GARGOYLE_STONEWING_ANTAGONIZER.name,
  activated: [
    {
      ref: `${THRABEN_GARGOYLE_STONEWING_ANTAGONIZER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
