// `Shalai's Acolyte` - a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHALAI_S_ACOLYTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHALAI_S_ACOLYTE, "Kicker {1}{G} (You may pay an additional {1}{G} as you cast this spell.)\nFlying\nIf this creature was kicked, it enters with two +1/+1 counters on it.");
const LINES = PRINTED.split('\n');


export const SHALAIS_ACOLYTE_SCRIPT: CardScript = {
  oracleId: SHALAI_S_ACOLYTE.oracleId,
  name: SHALAI_S_ACOLYTE.name,
  replacements: [
    {
      abilityId: 'enters-with-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        (ev.t === 'CardsMoved' ? (ev.moves.find((m) => m.card === self)?.kicked ?? 0) : 0) > 0 && ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 2 }] }],
    },
  ],
};
