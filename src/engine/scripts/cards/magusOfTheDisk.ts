// `Magus of the Disk` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGUS_OF_THE_DISK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGUS_OF_THE_DISK, "This creature enters tapped.\n{1}, {T}: Destroy all artifacts, creatures, and enchantments.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy all artifacts, creatures, and enchantments.", MAGUS_OF_THE_DISK.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy all artifacts, creatures, and enchantments.");

export const MAGUS_OF_THE_DISK_SCRIPT: CardScript = {
  oracleId: MAGUS_OF_THE_DISK.oracleId,
  name: MAGUS_OF_THE_DISK.name,
  activated: [
    {
      ref: `${MAGUS_OF_THE_DISK.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
