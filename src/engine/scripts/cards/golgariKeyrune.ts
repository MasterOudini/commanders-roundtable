// `Golgari Keyrune` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOLGARI_KEYRUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLGARI_KEYRUNE, "{T}: Add {B} or {G}.\n{B}{G}: This artifact becomes a 2/2 black and green Insect artifact creature with deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/2 black and green Insect artifact creature with deathtouch until end of turn.", GOLGARI_KEYRUNE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/2 black and green Insect artifact creature with deathtouch until end of turn.");

export const GOLGARI_KEYRUNE_SCRIPT: CardScript = {
  oracleId: GOLGARI_KEYRUNE.oracleId,
  name: GOLGARI_KEYRUNE.name,
  activated: [
    {
      ref: `${GOLGARI_KEYRUNE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
