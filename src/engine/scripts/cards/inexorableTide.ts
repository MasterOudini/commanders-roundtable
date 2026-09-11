// `Inexorable Tide` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INEXORABLE_TIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INEXORABLE_TIDE, "Whenever you cast a spell, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_L0 = vocabularyEffects("Proliferate.", INEXORABLE_TIDE.name);
const VOCAB_T_L0 = vocabularyTargets("Proliferate.");

export const INEXORABLE_TIDE_SCRIPT: CardScript = {
  oracleId: INEXORABLE_TIDE.oracleId,
  name: INEXORABLE_TIDE.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self),
      label: () => "Inexorable Tide - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
