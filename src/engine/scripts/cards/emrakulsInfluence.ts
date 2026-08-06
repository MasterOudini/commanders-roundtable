// `Emrakul's Influence` — "Whenever you cast an Eldrazi creature spell with
// mana value 7 or greater, draw two cards." A cast filter on subtype, type
// AND the printing's mana value — the number `targets.ts` has read off the
// oracle for stack objects since D139. M6.4q, D173.

import { EMRAKUL_S_INFLUENCE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  EMRAKUL_S_INFLUENCE,
  'Whenever you cast an Eldrazi creature spell with mana value 7 or greater, draw two cards.',
);

export const EMRAKULS_INFLUENCE_SCRIPT: CardScript = {
  oracleId: EMRAKUL_S_INFLUENCE.oracleId,
  name: EMRAKUL_S_INFLUENCE.name,
  triggers: [
    {
      abilityId: 'eldrazi-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc || (oc.manaValue ?? 0) < 7) return false;
        const face = faceOf(oc, ev.obj.faceIndex);
        return face.typeLine.types.includes('Creature') && face.typeLine.subtypes.includes('Eldrazi');
      },
      label: () => "Emrakul's Influence — draw two cards",
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
