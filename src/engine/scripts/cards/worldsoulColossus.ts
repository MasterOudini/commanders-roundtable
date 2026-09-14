// `Worldsoul Colossus` - a static entersWithCountersX
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WORLDSOUL_COLOSSUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WORLDSOUL_COLOSSUS, "Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.)\nThis creature enters with X +1/+1 counters on it.");
const LINES = PRINTED.split('\n');

export const WORLDSOUL_COLOSSUS_SCRIPT: CardScript = {
  oracleId: WORLDSOUL_COLOSSUS.oracleId,
  name: WORLDSOUL_COLOSSUS.name,
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (ctx, self, ev): readonly EventBody[] => {
        // The cast's X, read off the stack object the spell still is (CR 608.2).
        const x = ctx.state.stack.find((o) => o.card === self)?.xValue ?? 0;
        return x > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: x }] }] : [ev];
      },
    },
  ],
};
