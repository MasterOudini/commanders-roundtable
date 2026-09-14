// `Dimir Guildmage` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIMIR_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIMIR_GUILDMAGE, "({U/B} can be paid with either {U} or {B}.)\n{3}{U}: Target player draws a card. Activate only as a sorcery.\n{3}{B}: Target player discards a card. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player draws a card.", DIMIR_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player draws a card.");
const VOCAB_A1 = vocabularyEffects("Target player discards a card.", DIMIR_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Target player discards a card.");

export const DIMIR_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: DIMIR_GUILDMAGE.oracleId,
  name: DIMIR_GUILDMAGE.name,
  activated: [
    {
      ref: `${DIMIR_GUILDMAGE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${DIMIR_GUILDMAGE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
