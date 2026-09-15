// `Bloodied Ghost` - a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODIED_GHOST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODIED_GHOST, "Flying\nThis creature enters with a -1/-1 counter on it.");
const LINES = PRINTED.split('\n');

export const BLOODIED_GHOST_SCRIPT: CardScript = {
  oracleId: BLOODIED_GHOST.oracleId,
  name: BLOODIED_GHOST.name,
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 1 }] }],
    },
  ],
};
