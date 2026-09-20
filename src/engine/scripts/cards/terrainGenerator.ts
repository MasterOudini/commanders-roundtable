// `Terrain Generator` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TERRAIN_GENERATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TERRAIN_GENERATOR, "{T}: Add {C}.\n{2}, {T}: You may put a basic land card from your hand onto the battlefield tapped.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("You may put a basic land card from your hand onto the battlefield tapped.", TERRAIN_GENERATOR.name);
const VOCAB_T_A1 = vocabularyTargets("You may put a basic land card from your hand onto the battlefield tapped.");

export const TERRAIN_GENERATOR_SCRIPT: CardScript = {
  oracleId: TERRAIN_GENERATOR.oracleId,
  name: TERRAIN_GENERATOR.name,
  activated: [
    {
      ref: `${TERRAIN_GENERATOR.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
