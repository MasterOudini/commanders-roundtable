// `The Great Mound` - an activation vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_GREAT_MOUND } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(THE_GREAT_MOUND, "{T}: Add {C}.\n{3}, {T}: Create a tapped Vibranium token. (It's an artifact with indestructible and \"{T}: Add {C}. This mana can't be spent to cast a nonartifact spell.\")\n{6}, {T}: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Create a tapped Vibranium token.", THE_GREAT_MOUND.name);
const VOCAB_T_A1 = vocabularyTargets("Create a tapped Vibranium token.");

export const THE_GREAT_MOUND_SCRIPT: CardScript = {
  oracleId: THE_GREAT_MOUND.oracleId,
  name: THE_GREAT_MOUND.name,
  activated: [
    {
      ref: `${THE_GREAT_MOUND.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${THE_GREAT_MOUND.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
