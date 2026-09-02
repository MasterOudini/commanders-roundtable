// `Spare Supplies` — "This artifact enters tapped.\nWhen this artifact
// enters, draw a card.\n{2}, {T}, Sacrifice this artifact: Draw a card."
// Elixir of Vitality's enters-tapped line (the engine's, D275) over Futurist
// Forge's entry draw and a Cluestone-shaped sacrifice-draw. D281.

import { SPARE_SUPPLIES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SPARE_SUPPLIES,
  'This artifact enters tapped.\nWhen this artifact enters, draw a card.\n{2}, {T}, Sacrifice this artifact: Draw a card.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const DRAW = PRINTED.split('\n')[2] as string;

export const SPARE_SUPPLIES_SCRIPT: CardScript = {
  oracleId: SPARE_SUPPLIES.oracleId,
  name: SPARE_SUPPLIES.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Spare Supplies — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => [...drawEvents(ctx.state, obj.controller, 1)],
    },
  ],
  activated: [
    {
      ref: `${SPARE_SUPPLIES.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
