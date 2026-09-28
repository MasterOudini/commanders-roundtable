// `Tarkir Duneshaper // Burnished Dunestomper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER, "{4}{G/P}: Transform this creature. Activate only as a sorcery. ({G/P} can be paid with either {G} or 2 life.)\nTrample");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER_SCRIPT: CardScript = {
  oracleId: TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER.oracleId,
  name: TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER.name,
  activated: [
    {
      ref: `${TARKIR_DUNESHAPER_BURNISHED_DUNESTOMPER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
