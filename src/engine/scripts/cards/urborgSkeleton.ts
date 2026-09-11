// `Urborg Skeleton` - an activation regenerate, a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { URBORG_SKELETON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(URBORG_SKELETON, "Kicker {3} (You may pay an additional {3} as you cast this spell.)\n{B}: Regenerate this creature.\nIf this creature was kicked, it enters with a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');


export const URBORG_SKELETON_SCRIPT: CardScript = {
  oracleId: URBORG_SKELETON.oracleId,
  name: URBORG_SKELETON.name,
  activated: [
    {
      ref: `${URBORG_SKELETON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }],
    },
  ],
};
