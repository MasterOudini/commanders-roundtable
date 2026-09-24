// `Quag Vampires` - a static entersWithCountersPer
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUAG_VAMPIRES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUAG_VAMPIRES, "Multikicker {1}{B} (You may pay an additional {1}{B} any number of times as you cast this spell.)\nSwampwalk (This creature can't be blocked as long as defending player controls a Swamp.)\nThis creature enters with a +1/+1 counter on it for each time it was kicked.");
const LINES = PRINTED.split('\n');

export const QUAG_VAMPIRES_SCRIPT: CardScript = {
  oracleId: QUAG_VAMPIRES.oracleId,
  name: QUAG_VAMPIRES.name,
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
