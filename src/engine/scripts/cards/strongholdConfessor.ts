// `Stronghold Confessor` - a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STRONGHOLD_CONFESSOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STRONGHOLD_CONFESSOR, "Kicker {3} (You may pay an additional {3} as you cast this spell.)\nMenace (This creature can't be blocked except by two or more creatures.)\nIf this creature was kicked, it enters with two +1/+1 counters on it.");
const LINES = PRINTED.split('\n');


export const STRONGHOLD_CONFESSOR_SCRIPT: CardScript = {
  oracleId: STRONGHOLD_CONFESSOR.oracleId,
  name: STRONGHOLD_CONFESSOR.name,
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
