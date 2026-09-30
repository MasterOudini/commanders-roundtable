// `Poised Practitioner` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POISED_PRACTITIONER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POISED_PRACTITIONER, "Flurry — Whenever you cast your second spell each turn, put a +1/+1 counter on this creature. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on this creature. Scry 1.", POISED_PRACTITIONER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on this creature. Scry 1.");

export const POISED_PRACTITIONER_SCRIPT: CardScript = {
  oracleId: POISED_PRACTITIONER.oracleId,
  name: POISED_PRACTITIONER.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Poised Practitioner - Put a +1/+1 counter on this creature. Scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
