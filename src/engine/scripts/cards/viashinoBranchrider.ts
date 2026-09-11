// `Viashino Branchrider` - a static entersWithCounters, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIASHINO_BRANCHRIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHINO_BRANCHRIDER, "Kicker {2}{G} (You may pay an additional {2}{G} as you cast this spell.)\nHaste\nIf this creature was kicked, it enters with two +1/+1 counters on it.\n{2}{R}: This creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');


export const VIASHINO_BRANCHRIDER_SCRIPT: CardScript = {
  oracleId: VIASHINO_BRANCHRIDER.oracleId,
  name: VIASHINO_BRANCHRIDER.name,
  activated: [
    {
      ref: `${VIASHINO_BRANCHRIDER.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
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
