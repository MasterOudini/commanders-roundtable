// `Wirewood Symbiote` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WIREWOOD_SYMBIOTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WIREWOOD_SYMBIOTE, "Return an Elf you control to its owner's hand: Untap target creature. Activate only once each turn.");

const VOCAB_A0 = vocabularyEffects("Untap target creature.", WIREWOOD_SYMBIOTE.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target creature.");

export const WIREWOOD_SYMBIOTE_SCRIPT: CardScript = {
  oracleId: WIREWOOD_SYMBIOTE.oracleId,
  name: WIREWOOD_SYMBIOTE.name,
  activated: [
    {
      ref: `${WIREWOOD_SYMBIOTE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
