// `Iron-Shield Elf` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRON_SHIELD_ELF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IRON_SHIELD_ELF, "Discard a card: This creature gains indestructible until end of turn. Tap it. (Damage and effects that say \"destroy\" don't destroy it. If its toughness is 0 or less, it still dies.)");

const VOCAB_A0 = vocabularyEffects("~ gains indestructible until end of turn. Tap it.", IRON_SHIELD_ELF.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains indestructible until end of turn. Tap it.");

export const IRON_SHIELD_ELF_SCRIPT: CardScript = {
  oracleId: IRON_SHIELD_ELF.oracleId,
  name: IRON_SHIELD_ELF.name,
  activated: [
    {
      ref: `${IRON_SHIELD_ELF.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
