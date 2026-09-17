// `Spinewoods Armadillo` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPINEWOODS_ARMADILLO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPINEWOODS_ARMADILLO, "Reach\nWard {3} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {3}.)\n{1}{G}, Discard this card: Search your library for a basic land card or a Desert card, reveal it, put it into your hand, then shuffle. You gain 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card or a Desert card, reveal it, put it into your hand, then shuffle. You gain 3 life.", SPINEWOODS_ARMADILLO.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card or a Desert card, reveal it, put it into your hand, then shuffle. You gain 3 life.");

export const SPINEWOODS_ARMADILLO_SCRIPT: CardScript = {
  oracleId: SPINEWOODS_ARMADILLO.oracleId,
  name: SPINEWOODS_ARMADILLO.name,
  activated: [
    {
      ref: `${SPINEWOODS_ARMADILLO.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
