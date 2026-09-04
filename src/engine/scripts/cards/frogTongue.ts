// `Frog Tongue` - an Aura (Enchant creature): the enchanted creature (on entering: draw 1); has reach.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { FROG_TONGUE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(FROG_TONGUE, "Enchant creature\nWhen this Aura enters, draw a card.\nEnchanted creature has reach. (It can block creatures with flying.)");
const LINES = PRINTED.split('\n');

export const FROG_TONGUE_SCRIPT: CardScript = {
  oracleId: FROG_TONGUE.oracleId,
  name: FROG_TONGUE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Frog Tongue - draw a card",
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
  statics: [
    {
      abilityId: 'enchanted-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("reach");
      },
    },
  ],
};
