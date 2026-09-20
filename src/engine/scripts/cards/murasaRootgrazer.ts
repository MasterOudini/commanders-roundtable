// `Murasa Rootgrazer` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MURASA_ROOTGRAZER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MURASA_ROOTGRAZER, "Vigilance\n{T}: You may put a basic land card from your hand onto the battlefield.\n{T}: Return target basic land you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You may put a basic land card from your hand onto the battlefield.", MURASA_ROOTGRAZER.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a basic land card from your hand onto the battlefield.");
const VOCAB_A1 = vocabularyEffects("Return target basic land you control to its owner's hand.", MURASA_ROOTGRAZER.name);
const VOCAB_T_A1 = vocabularyTargets("Return target basic land you control to its owner's hand.");

export const MURASA_ROOTGRAZER_SCRIPT: CardScript = {
  oracleId: MURASA_ROOTGRAZER.oracleId,
  name: MURASA_ROOTGRAZER.name,
  activated: [
    {
      ref: `${MURASA_ROOTGRAZER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${MURASA_ROOTGRAZER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
