// `Jhoira, Weatherlight Captain` — "Whenever you cast a historic spell,
// draw a card." D'Avenant Trapper's historic filter (Artifact type,
// Legendary supertype, or Saga subtype, off the face actually cast) paying
// in cards. M6.4aa, D183.

import { JHOIRA_WEATHERLIGHT_CAPTAIN } from '../../../data/fixtures/engineCards';
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
  JHOIRA_WEATHERLIGHT_CAPTAIN,
  'Whenever you cast a historic spell, draw a card. (Artifacts, legendaries, and Sagas are historic.)',
);

export const JHOIRA_WEATHERLIGHT_CAPTAIN_SCRIPT: CardScript = {
  oracleId: JHOIRA_WEATHERLIGHT_CAPTAIN.oracleId,
  name: JHOIRA_WEATHERLIGHT_CAPTAIN.name,
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
        return (
          face.typeLine.types.includes('Artifact') ||
          face.typeLine.supertypes.includes('Legendary') ||
          face.typeLine.subtypes.includes('Saga')
        );
      },
      label: () => 'Jhoira — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
