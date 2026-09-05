// `Barkhide Troll` - a static entersWithCounters, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BARKHIDE_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BARKHIDE_TROLL, "This creature enters with a +1/+1 counter on it.\n{1}, Remove a +1/+1 counter from this creature: This creature gains hexproof until end of turn. (It can't be the target of spells or abilities your opponents control.)");
const LINES = PRINTED.split('\n');

export const BARKHIDE_TROLL_SCRIPT: CardScript = {
  oracleId: BARKHIDE_TROLL.oracleId,
  name: BARKHIDE_TROLL.name,
  activated: [
    {
      ref: `${BARKHIDE_TROLL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["hexproof"] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D319).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }],
    },
  ],
};
