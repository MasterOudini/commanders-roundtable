// `Nevinyrral's Disk` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEVINYRRAL_S_DISK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEVINYRRAL_S_DISK, "This artifact enters tapped.\n{1}, {T}: Destroy all artifacts, creatures, and enchantments.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy all artifacts, creatures, and enchantments.", NEVINYRRAL_S_DISK.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy all artifacts, creatures, and enchantments.");

export const NEVINYRRALS_DISK_SCRIPT: CardScript = {
  oracleId: NEVINYRRAL_S_DISK.oracleId,
  name: NEVINYRRAL_S_DISK.name,
  activated: [
    {
      ref: `${NEVINYRRAL_S_DISK.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
