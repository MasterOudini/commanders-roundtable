// `Gitaxian Raptor` - a static entersWithCounters, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GITAXIAN_RAPTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GITAXIAN_RAPTOR, "Flying\nThis creature enters with three oil counters on it.\nRemove an oil counter from this creature: This creature gets +1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

export const GITAXIAN_RAPTOR_SCRIPT: CardScript = {
  oracleId: GITAXIAN_RAPTOR.oracleId,
  name: GITAXIAN_RAPTOR.name,
  activated: [
    {
      ref: `${GITAXIAN_RAPTOR.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 3 }] }],
    },
  ],
};
