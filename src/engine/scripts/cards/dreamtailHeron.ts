// `Dreamtail Heron` - a mutates trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAMTAIL_HERON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAMTAIL_HERON, "Mutate {3}{U} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nFlying\nWhenever this creature mutates, draw a card.");
const LINES = PRINTED.split('\n');

export const DREAMTAIL_HERON_SCRIPT: CardScript = {
  oracleId: DREAMTAIL_HERON.oracleId,
  name: DREAMTAIL_HERON.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Dreamtail Heron - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
