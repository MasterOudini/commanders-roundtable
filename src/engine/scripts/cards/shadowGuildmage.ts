// `Shadow Guildmage` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHADOW_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHADOW_GUILDMAGE, "{U}, {T}: Put target creature you control on top of its owner's library.\n{R}, {T}: This creature deals 1 damage to any target and 1 damage to you.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put target creature you control on top of its owner's library.", SHADOW_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Put target creature you control on top of its owner's library.");
const VOCAB_A1 = vocabularyEffects("~ deals 1 damage to any target and 1 damage to you.", SHADOW_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("~ deals 1 damage to any target and 1 damage to you.");

export const SHADOW_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: SHADOW_GUILDMAGE.oracleId,
  name: SHADOW_GUILDMAGE.name,
  activated: [
    {
      ref: `${SHADOW_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SHADOW_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
