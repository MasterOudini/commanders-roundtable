// `Codex Shredder` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CODEX_SHREDDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CODEX_SHREDDER, "{T}: Target player mills a card. (They put the top card of their library into their graveyard.)\n{5}, {T}, Sacrifice this artifact: Return target card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player mills a card.", CODEX_SHREDDER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills a card.");
const VOCAB_A1 = vocabularyEffects("Return target card from your graveyard to your hand.", CODEX_SHREDDER.name);
const VOCAB_T_A1 = vocabularyTargets("Return target card from your graveyard to your hand.");

export const CODEX_SHREDDER_SCRIPT: CardScript = {
  oracleId: CODEX_SHREDDER.oracleId,
  name: CODEX_SHREDDER.name,
  activated: [
    {
      ref: `${CODEX_SHREDDER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${CODEX_SHREDDER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
