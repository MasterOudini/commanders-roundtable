// `Whisper Squad` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHISPER_SQUAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHISPER_SQUAD, "{1}{B}: Search your library for a card named Whisper Squad, put it onto the battlefield tapped, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for a card named ~, put it onto the battlefield tapped, then shuffle.", WHISPER_SQUAD.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card named ~, put it onto the battlefield tapped, then shuffle.");

export const WHISPER_SQUAD_SCRIPT: CardScript = {
  oracleId: WHISPER_SQUAD.oracleId,
  name: WHISPER_SQUAD.name,
  activated: [
    {
      ref: `${WHISPER_SQUAD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
