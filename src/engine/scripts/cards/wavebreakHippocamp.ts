// `Wavebreak Hippocamp` - a castInOpponentsTurn trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAVEBREAK_HIPPOCAMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAVEBREAK_HIPPOCAMP, "Whenever you cast your first spell during each opponent's turn, draw a card.");

export const WAVEBREAK_HIPPOCAMP_SCRIPT: CardScript = {
  oracleId: WAVEBREAK_HIPPOCAMP.oracleId,
  name: WAVEBREAK_HIPPOCAMP.name,
  triggers: [
    {
      abilityId: 'castInOpponentsTurn-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 1,
      label: () => "Wavebreak Hippocamp - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
