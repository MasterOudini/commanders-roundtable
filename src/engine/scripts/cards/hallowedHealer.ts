// `Hallowed Healer` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HALLOWED_HEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HALLOWED_HEALER, "{T}: Prevent the next 2 damage that would be dealt to any target this turn.\nThreshold — {T}: Prevent the next 4 damage that would be dealt to any target this turn. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 2 damage that would be dealt to any target this turn.", HALLOWED_HEALER.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.");
const VOCAB_A1 = vocabularyEffects("Prevent the next 4 damage that would be dealt to any target this turn.", HALLOWED_HEALER.name);
const VOCAB_T_A1 = vocabularyTargets("Prevent the next 4 damage that would be dealt to any target this turn.");

export const HALLOWED_HEALER_SCRIPT: CardScript = {
  oracleId: HALLOWED_HEALER.oracleId,
  name: HALLOWED_HEALER.name,
  activated: [
    {
      ref: `${HALLOWED_HEALER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${HALLOWED_HEALER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
