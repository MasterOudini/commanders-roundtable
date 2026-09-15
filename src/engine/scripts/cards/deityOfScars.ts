// `Deity of Scars` - a static entersWithCounters, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEITY_OF_SCARS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEITY_OF_SCARS, "Trample\nThis creature enters with two -1/-1 counters on it.\n{B/G}, Remove a -1/-1 counter from this creature: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const DEITY_OF_SCARS_SCRIPT: CardScript = {
  oracleId: DEITY_OF_SCARS.oracleId,
  name: DEITY_OF_SCARS.name,
  activated: [
    {
      ref: `${DEITY_OF_SCARS.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 2 }] }],
    },
  ],
};
