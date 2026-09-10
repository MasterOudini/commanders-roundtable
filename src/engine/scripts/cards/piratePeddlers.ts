// `Pirate Peddlers` - a youSacrifice trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PIRATE_PEDDLERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PIRATE_PEDDLERS, "Deathtouch\nWhenever you sacrifice another permanent, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const PIRATE_PEDDLERS_SCRIPT: CardScript = {
  oracleId: PIRATE_PEDDLERS.oracleId,
  name: PIRATE_PEDDLERS.name,
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
      label: () => "Pirate Peddlers - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
