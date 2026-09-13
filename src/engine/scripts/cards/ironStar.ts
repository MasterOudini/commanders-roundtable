// `Iron Star` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRON_STAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IRON_STAR, "Whenever a player casts a red spell, you may pay {1}. If you do, you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, you gain 1 life.", IRON_STAR.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, you gain 1 life.");

export const IRON_STAR_SCRIPT: CardScript = {
  oracleId: IRON_STAR.oracleId,
  name: IRON_STAR.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Iron Star - You may pay {1}. If you do, you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
