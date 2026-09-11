// `Pincer Spider` - a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PINCER_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PINCER_SPIDER, "Kicker {3} (You may pay an additional {3} as you cast this spell.)\nReach (This creature can block creatures with flying.)\nIf this creature was kicked, it enters with a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');


export const PINCER_SPIDER_SCRIPT: CardScript = {
  oracleId: PINCER_SPIDER.oracleId,
  name: PINCER_SPIDER.name,
  replacements: [
    {
      abilityId: 'enters-with-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        (ev.t === 'CardsMoved' ? (ev.moves.find((m) => m.card === self)?.kicked ?? 0) : 0) > 0 && ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }],
    },
  ],
};
