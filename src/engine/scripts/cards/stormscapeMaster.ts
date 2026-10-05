// `Stormscape Master` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORMSCAPE_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STORMSCAPE_MASTER, "{W}{W}, {T}: Target creature gains protection from the color of your choice until end of turn.\n{B}{B}, {T}: Target player loses 2 life and you gain 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature gains protection from the color of your choice until end of turn.", STORMSCAPE_MASTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gains protection from the color of your choice until end of turn.");
const VOCAB_A1 = vocabularyEffects("Target player loses 2 life and you gain 2 life.", STORMSCAPE_MASTER.name);
const VOCAB_T_A1 = vocabularyTargets("Target player loses 2 life and you gain 2 life.");

export const STORMSCAPE_MASTER_SCRIPT: CardScript = {
  oracleId: STORMSCAPE_MASTER.oracleId,
  name: STORMSCAPE_MASTER.name,
  activated: [
    {
      ref: `${STORMSCAPE_MASTER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${STORMSCAPE_MASTER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
