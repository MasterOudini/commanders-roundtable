// `Flourishing Fox` - a youCycle trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLOURISHING_FOX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOURISHING_FOX, "Whenever you cycle another card, put a +1/+1 counter on this creature.\nCycling {1} ({1}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

export const FLOURISHING_FOX_SCRIPT: CardScript = {
  oracleId: FLOURISHING_FOX.oracleId,
  name: FLOURISHING_FOX.name,
  triggers: [
    {
      abilityId: 'youCycle-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand' && m.card !== self && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Flourishing Fox - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
