// `Dawnray Archer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAWNRAY_ARCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAWNRAY_ARCHER, "Exalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\n{W}, {T}: This creature deals 1 damage to target attacking or blocking creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to target attacking or blocking creature.", DAWNRAY_ARCHER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to target attacking or blocking creature.");

export const DAWNRAY_ARCHER_SCRIPT: CardScript = {
  oracleId: DAWNRAY_ARCHER.oracleId,
  name: DAWNRAY_ARCHER.name,
  activated: [
    {
      ref: `${DAWNRAY_ARCHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
