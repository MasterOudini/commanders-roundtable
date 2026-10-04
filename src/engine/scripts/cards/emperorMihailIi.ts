// `Emperor Mihail II` - a static topOfLibrary, a static topOfLibrary, a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMPEROR_MIHAIL_II } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMPEROR_MIHAIL_II, "You may look at the top card of your library any time.\nYou may cast Merfolk spells from the top of your library.\nWhenever you cast a Merfolk spell, you may pay {1}. If you do, create a 1/1 blue Merfolk creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You may pay {1}. If you do, create a 1/1 blue Merfolk creature token.", EMPEROR_MIHAIL_II.name);
const VOCAB_T_L2 = vocabularyTargets("You may pay {1}. If you do, create a 1/1 blue Merfolk creature token.");

export const EMPEROR_MIHAIL_II_SCRIPT: CardScript = {
  oracleId: EMPEROR_MIHAIL_II.oracleId,
  name: EMPEROR_MIHAIL_II.name,
  triggers: [
    {
      abilityId: 'castSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.subtypes.includes('Merfolk'),
      label: () => "Emperor Mihail II - You may pay {1}. If you do, create a 1/1 blue Merfolk creature token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  topOfLibrary: [
    { abilityId: "top-0", text: LINES[0] as string, look: true },
    { abilityId: "top-1", text: LINES[1] as string, spells: {"predicates":[{"supertypes":[],"types":[],"subtypes":["Merfolk"],"colors":[]}]} },
  ],
};
