// `Orthion, Hero of Lavabrink` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORTHION_HERO_OF_LAVABRINK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORTHION_HERO_OF_LAVABRINK, "{1}{R}, {T}: Create a token that's a copy of another target creature you control. It gains haste. Sacrifice it at the beginning of the next end step. Activate only as a sorcery.\n{6}{R}{R}{R}, {T}: Create five tokens that are copies of another target creature you control. They gain haste. Sacrifice them at the beginning of the next end step. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Create a token that's a copy of another target creature you control. It gains haste. Sacrifice it at the beginning of the next end step.", ORTHION_HERO_OF_LAVABRINK.name);
const VOCAB_T_A0 = vocabularyTargets("Create a token that's a copy of another target creature you control. It gains haste. Sacrifice it at the beginning of the next end step.");
const VOCAB_A1 = vocabularyEffects("Create five tokens that are copies of another target creature you control. They gain haste. Sacrifice them at the beginning of the next end step.", ORTHION_HERO_OF_LAVABRINK.name);
const VOCAB_T_A1 = vocabularyTargets("Create five tokens that are copies of another target creature you control. They gain haste. Sacrifice them at the beginning of the next end step.");

export const ORTHION_HERO_OF_LAVABRINK_SCRIPT: CardScript = {
  oracleId: ORTHION_HERO_OF_LAVABRINK.oracleId,
  name: ORTHION_HERO_OF_LAVABRINK.name,
  activated: [
    {
      ref: `${ORTHION_HERO_OF_LAVABRINK.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ORTHION_HERO_OF_LAVABRINK.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
