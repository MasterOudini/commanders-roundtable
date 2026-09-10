// `Giant Fly` - a youSacrifice trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIANT_FLY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIANT_FLY, "Flying\nWhenever you sacrifice another permanent, this creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const GIANT_FLY_SCRIPT: CardScript = {
  oracleId: GIANT_FLY.oracleId,
  name: GIANT_FLY.name,
  triggers: [
    {
      abilityId: 'youSacrifice-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'sacrifice' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self),
        ),
      label: () => "Giant Fly - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
