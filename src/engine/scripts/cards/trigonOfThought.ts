// `Trigon of Thought` - a static entersWithCounters, an activation selfCounter, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRIGON_OF_THOUGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRIGON_OF_THOUGHT, "This artifact enters with three charge counters on it.\n{U}{U}, {T}: Put a charge counter on this artifact.\n{2}, {T}, Remove a charge counter from this artifact: Draw a card.");
const LINES = PRINTED.split('\n');

export const TRIGON_OF_THOUGHT_SCRIPT: CardScript = {
  oracleId: TRIGON_OF_THOUGHT.oracleId,
  name: TRIGON_OF_THOUGHT.name,
  activated: [
    {
      ref: `${TRIGON_OF_THOUGHT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 1 }] }];
      },
    },
    {
      ref: `${TRIGON_OF_THOUGHT.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "charge", delta: 3 }] }],
    },
  ],
};
