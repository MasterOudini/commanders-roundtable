// `Jarvis, Earth's Mightiest Butler` — "Whenever you cast a Hero spell,
// draw a card." The Hero-subtype cast-watcher, off the face actually cast.
// M6.4z, D182.

import { JARVIS_EARTH_S_MIGHTIEST_BUTLER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(JARVIS_EARTH_S_MIGHTIEST_BUTLER, 'Whenever you cast a Hero spell, draw a card.');

export const JARVIS_EARTHS_MIGHTIEST_BUTLER_SCRIPT: CardScript = {
  oracleId: JARVIS_EARTH_S_MIGHTIEST_BUTLER.oracleId,
  name: JARVIS_EARTH_S_MIGHTIEST_BUTLER.name,
  triggers: [
    {
      abilityId: 'cast',
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
        if (!oc) return false;
        const face = faceOf(oc, ev.obj.faceIndex);
        return face.typeLine.subtypes.includes('Hero');
      },
      label: () => 'Jarvis — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
