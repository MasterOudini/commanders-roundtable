// `Cragplate Baloth` - a static cantBeCountered, a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRAGPLATE_BALOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRAGPLATE_BALOTH, "Kicker {2}{G}\nThis spell can't be countered.\nHexproof, haste\nIf this creature was kicked, it enters with four +1/+1 counters on it.");
const LINES = PRINTED.split('\n');


export const CRAGPLATE_BALOTH_SCRIPT: CardScript = {
  oracleId: CRAGPLATE_BALOTH.oracleId,
  name: CRAGPLATE_BALOTH.name,
  cantBeCountered: { abilityId: 'cant-be-countered-1', text: LINES[1] as string },
  replacements: [
    {
      abilityId: 'enters-with-3',
      text: LINES[3] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        (ev.t === 'CardsMoved' ? (ev.moves.find((m) => m.card === self)?.kicked ?? 0) : 0) > 0 && ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 4 }] }],
    },
  ],
};
