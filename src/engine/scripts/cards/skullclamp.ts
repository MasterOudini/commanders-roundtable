// `Skullclamp` - an Equipment: the equipped creature gets +1/-1; (on the equipped creature dying: draw 2).
// The Equip line is the engine's own - a synthesized activated ability whose offer, charge
// and attach are the engine's (D305); the rest are defs whose one candidate is whatever
// the Equipment is attached to. Generated from one table row.

import { SKULLCLAMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKULLCLAMP, "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}");
const LINES = PRINTED.split('\n');

export const SKULLCLAMP_SCRIPT: CardScript = {
  oracleId: SKULLCLAMP.oracleId,
  name: SKULLCLAMP.name,
  triggers: [
    {
      abilityId: 'equippedDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && m.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Skullclamp - draw two cards",
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
  statics: [
    {
      abilityId: 'equipped-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Equipment is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += -1;
      },
    },
  ],
};
