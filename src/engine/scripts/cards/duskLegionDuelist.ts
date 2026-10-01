// `Dusk Legion Duelist` - a countersPutOnSelf trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSK_LEGION_DUELIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUSK_LEGION_DUELIST, "Vigilance\nWhenever one or more +1/+1 counters are put on this creature, draw a card. This ability triggers only once each turn.");
const LINES = PRINTED.split('\n');

export const DUSK_LEGION_DUELIST_SCRIPT: CardScript = {
  oracleId: DUSK_LEGION_DUELIST.oracleId,
  name: DUSK_LEGION_DUELIST.name,
  triggers: [
    {
      abilityId: 'countersPutOnSelf-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Dusk Legion Duelist - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
