// `Skemfar Elderhall` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKEMFAR_ELDERHALL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKEMFAR_ELDERHALL, "This land enters tapped.\n{T}: Add {G}.\n{2}{B}{B}{G}, {T}, Sacrifice this land: Up to one target creature you don't control gets -2/-2 until end of turn. Create two 1/1 green Elf Warrior creature tokens. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Up to one target creature you don't control gets -2/-2 until end of turn. Create two 1/1 green Elf Warrior creature tokens.", SKEMFAR_ELDERHALL.name);
const VOCAB_T_A1 = vocabularyTargets("Up to one target creature you don't control gets -2/-2 until end of turn. Create two 1/1 green Elf Warrior creature tokens.");

export const SKEMFAR_ELDERHALL_SCRIPT: CardScript = {
  oracleId: SKEMFAR_ELDERHALL.oracleId,
  name: SKEMFAR_ELDERHALL.name,
  activated: [
    {
      ref: `${SKEMFAR_ELDERHALL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
