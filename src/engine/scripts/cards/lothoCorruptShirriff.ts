// `Lotho, Corrupt Shirriff` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOTHO_CORRUPT_SHIRRIFF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOTHO_CORRUPT_SHIRRIFF, "Whenever a player casts their second spell each turn, you lose 1 life and create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");

const VOCAB_L0 = vocabularyEffects("You lose 1 life and create a Treasure token.", LOTHO_CORRUPT_SHIRRIFF.name);
const VOCAB_T_L0 = vocabularyTargets("You lose 1 life and create a Treasure token.");

export const LOTHO_CORRUPT_SHIRRIFF_SCRIPT: CardScript = {
  oracleId: LOTHO_CORRUPT_SHIRRIFF.oracleId,
  name: LOTHO_CORRUPT_SHIRRIFF.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) => ev.t === 'SpellCast' && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Lotho, Corrupt Shirriff - You lose 1 life and create a Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
