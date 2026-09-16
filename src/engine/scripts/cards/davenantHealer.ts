// `D'Avenant Healer` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { D_AVENANT_HEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(D_AVENANT_HEALER, "{T}: This creature deals 1 damage to target attacking or blocking creature.\n{T}: Prevent the next 1 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to target attacking or blocking creature.", D_AVENANT_HEALER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to target attacking or blocking creature.");
const VOCAB_A1 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", D_AVENANT_HEALER.name);
const VOCAB_T_A1 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

export const DAVENANT_HEALER_SCRIPT: CardScript = {
  oracleId: D_AVENANT_HEALER.oracleId,
  name: D_AVENANT_HEALER.name,
  activated: [
    {
      ref: `${D_AVENANT_HEALER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${D_AVENANT_HEALER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
