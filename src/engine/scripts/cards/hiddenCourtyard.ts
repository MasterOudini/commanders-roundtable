// `Hidden Courtyard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIDDEN_COURTYARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIDDEN_COURTYARD, "This land enters tapped.\n{T}: Add {W}.\n{4}{W}, {T}, Sacrifice this land: Discover 4. Activate only as a sorcery. (Exile cards from the top of your library until you exile a nonland card with mana value 4 or less. Cast it without paying its mana cost or put it into your hand. Put the rest on the bottom in a random order.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Discover 4.", HIDDEN_COURTYARD.name);
const VOCAB_T_A1 = vocabularyTargets("Discover 4.");

export const HIDDEN_COURTYARD_SCRIPT: CardScript = {
  oracleId: HIDDEN_COURTYARD.oracleId,
  name: HIDDEN_COURTYARD.name,
  activated: [
    {
      ref: `${HIDDEN_COURTYARD.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
