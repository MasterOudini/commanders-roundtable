// `Axiom Engraver` - a static entersWithCounters, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AXIOM_ENGRAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AXIOM_ENGRAVER, "This creature enters with two oil counters on it.\n{T}, Remove an oil counter from this creature, Discard a card: Draw a card.");
const LINES = PRINTED.split('\n');

export const AXIOM_ENGRAVER_SCRIPT: CardScript = {
  oracleId: AXIOM_ENGRAVER.oracleId,
  name: AXIOM_ENGRAVER.name,
  activated: [
    {
      ref: `${AXIOM_ENGRAVER.oracleId}#a0`,
      text: LINES[1] as string,
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 2 }] }],
    },
  ],
};
