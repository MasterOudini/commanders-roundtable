// `Gnarlback Rhino` — "Whenever you cast a spell that targets this creature,
// draw a card." Druid of Horns' cast-targets reader with the Aura filter
// dropped and the caster filter KEPT: MY spell, ANY type, aimed at the Rhino.
// M6.4u, D177.

import { GNARLBACK_RHINO } from '../../../data/fixtures/engineCards';
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
  GNARLBACK_RHINO,
  "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nWhenever you cast a spell that targets this creature, draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GNARLBACK_RHINO_SCRIPT: CardScript = {
  oracleId: GNARLBACK_RHINO.oracleId,
  name: GNARLBACK_RHINO.name,
  triggers: [
    {
      abilityId: 'self-targeted',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => 'Gnarlback Rhino — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
