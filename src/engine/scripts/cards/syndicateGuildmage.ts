// `Syndicate Guildmage` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SYNDICATE_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SYNDICATE_GUILDMAGE, "{1}{W}, {T}: Tap target creature with power 4 or greater.\n{4}{B}, {T}: This creature deals 2 damage to target opponent or planeswalker.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Tap target creature with power 4 or greater.", SYNDICATE_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target creature with power 4 or greater.");
const VOCAB_A1 = vocabularyEffects("~ deals 2 damage to target opponent or planeswalker.", SYNDICATE_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("~ deals 2 damage to target opponent or planeswalker.");

export const SYNDICATE_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: SYNDICATE_GUILDMAGE.oracleId,
  name: SYNDICATE_GUILDMAGE.name,
  activated: [
    {
      ref: `${SYNDICATE_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SYNDICATE_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
