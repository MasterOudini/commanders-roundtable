// `Faerie Squadron` - a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_SQUADRON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_SQUADRON, "Kicker {3}{U} (You may pay an additional {3}{U} as you cast this spell.)\nIf this creature was kicked, it enters with two +1/+1 counters on it and with flying.");
const LINES = PRINTED.split('\n');


export const FAERIE_SQUADRON_SCRIPT: CardScript = {
  oracleId: FAERIE_SQUADRON.oracleId,
  name: FAERIE_SQUADRON.name,
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        (ev.t === 'CardsMoved' ? (ev.moves.find((m) => m.card === self)?.kicked ?? 0) : 0) > 0 && ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }],
    },
  ],
  statics: [
    {
      abilityId: 'kicked-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && (ctx.state.cards[self]?.kicked ?? 0) > 0,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
