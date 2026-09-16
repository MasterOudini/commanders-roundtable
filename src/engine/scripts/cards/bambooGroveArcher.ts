// `Bamboo Grove Archer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BAMBOO_GROVE_ARCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BAMBOO_GROVE_ARCHER, "Defender, reach\nChannel — {4}{G}, Discard this card: Destroy target creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target creature with flying.", BAMBOO_GROVE_ARCHER.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target creature with flying.");

export const BAMBOO_GROVE_ARCHER_SCRIPT: CardScript = {
  oracleId: BAMBOO_GROVE_ARCHER.oracleId,
  name: BAMBOO_GROVE_ARCHER.name,
  activated: [
    {
      ref: `${BAMBOO_GROVE_ARCHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
