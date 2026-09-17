// `Vivien Reid` - an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIVIEN_REID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIVIEN_REID, "+1: Look at the top four cards of your library. You may reveal a creature or land card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.\n−3: Destroy target artifact, enchantment, or creature with flying.\n−8: You get an emblem with \"Creatures you control get +2/+2 and have vigilance, trample, and indestructible.\"");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Look at the top four cards of your library. You may reveal a creature or land card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", VIVIEN_REID.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top four cards of your library. You may reveal a creature or land card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");
const VOCAB_A1 = vocabularyEffects("Destroy target artifact, enchantment, or creature with flying.", VIVIEN_REID.name);
const VOCAB_T_A1 = vocabularyTargets("Destroy target artifact, enchantment, or creature with flying.");
const VOCAB_A2 = vocabularyEffects("You get an emblem with \"Creatures you control get +2/+2 and have vigilance, trample, and indestructible.\"", VIVIEN_REID.name);
const VOCAB_T_A2 = vocabularyTargets("You get an emblem with \"Creatures you control get +2/+2 and have vigilance, trample, and indestructible.\"");

export const VIVIEN_REID_SCRIPT: CardScript = {
  oracleId: VIVIEN_REID.oracleId,
  name: VIVIEN_REID.name,
  activated: [
    {
      ref: `${VIVIEN_REID.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${VIVIEN_REID.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${VIVIEN_REID.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
