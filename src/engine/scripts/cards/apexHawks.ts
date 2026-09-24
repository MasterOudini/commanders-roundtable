// `Apex Hawks` - a static entersWithCountersPer
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APEX_HAWKS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APEX_HAWKS, "Multikicker {1}{W} (You may pay an additional {1}{W} any number of times as you cast this spell.)\nFlying\nThis creature enters with a +1/+1 counter on it for each time it was kicked.");
const LINES = PRINTED.split('\n');

export const APEX_HAWKS_SCRIPT: CardScript = {
  oracleId: APEX_HAWKS.oracleId,
  name: APEX_HAWKS.name,
  replacements: [
    {
      abilityId: 'enters-with-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => {
        // D529 - the multikicker's count: the kicks the entering spell was cast with, off the move (CR 702.33c).
        const n = ev.t === 'CardsMoved' ? (ev.moves.find((m) => m.card === self)?.kicked ?? 0) : 0;
        return n > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: n }] }] : [ev];
      },
    },
  ],
};
