// `Argothian Enchantress` — "Shroud\nWhenever you cast an enchantment spell,
// draw a card." Talrand's cast-watching shape with the type asked of the face
// actually cast (D155); shroud is a printed Tier-2 keyword the targeting layer
// already enforces (D82), so the script owes exactly the trigger line.
// M6.4e, D162.

import { ARGOTHIAN_ENCHANTRESS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  ARGOTHIAN_ENCHANTRESS,
  "Shroud (This creature can't be the target of spells or abilities.)\nWhenever you cast an enchantment spell, draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ARGOTHIAN_ENCHANTRESS_SCRIPT: CardScript = {
  oracleId: ARGOTHIAN_ENCHANTRESS.oracleId,
  name: ARGOTHIAN_ENCHANTRESS.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      // "you cast" — the SPELL's controller; the TYPE from the face actually
      // cast (Talrand's rule). An enchantment CREATURE is an enchantment spell.
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Enchantment');
      },
      label: () => 'Argothian Enchantress — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
