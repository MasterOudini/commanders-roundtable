// `Krosan Restorer` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROSAN_RESTORER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_RESTORER, "{T}: Untap target land.\nThreshold — {T}: Untap up to three target lands. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap target land.", KROSAN_RESTORER.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target land.");
const VOCAB_A1 = vocabularyEffects("Untap up to three target lands.", KROSAN_RESTORER.name);
const VOCAB_T_A1 = vocabularyTargets("Untap up to three target lands.");

export const KROSAN_RESTORER_SCRIPT: CardScript = {
  oracleId: KROSAN_RESTORER.oracleId,
  name: KROSAN_RESTORER.name,
  activated: [
    {
      ref: `${KROSAN_RESTORER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${KROSAN_RESTORER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
