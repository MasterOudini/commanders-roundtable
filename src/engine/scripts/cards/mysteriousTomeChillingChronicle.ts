// `Mysterious Tome // Chilling Chronicle` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYSTERIOUS_TOME_CHILLING_CHRONICLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MYSTERIOUS_TOME_CHILLING_CHRONICLE, "{2}, {T}: Draw a card. Transform this artifact.\n{1}, {T}: Tap target nonland permanent. Transform this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Draw a card. Transform this artifact.", MYSTERIOUS_TOME_CHILLING_CHRONICLE.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Draw a card. Transform this artifact.");
const VOCAB_A0b = transformFrom(vocabularyEffects("Tap target nonland permanent. Transform this artifact.", MYSTERIOUS_TOME_CHILLING_CHRONICLE.name), 1);
const VOCAB_T_A0b = vocabularyTargets("Tap target nonland permanent. Transform this artifact.");

export const MYSTERIOUS_TOME_CHILLING_CHRONICLE_SCRIPT: CardScript = {
  oracleId: MYSTERIOUS_TOME_CHILLING_CHRONICLE.oracleId,
  name: MYSTERIOUS_TOME_CHILLING_CHRONICLE.name,
  activated: [
    {
      ref: `${MYSTERIOUS_TOME_CHILLING_CHRONICLE.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${MYSTERIOUS_TOME_CHILLING_CHRONICLE.oracleId}#a0`, face: 1,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0b, VOCAB_T_A0b);
      },
    },
  ],
};
