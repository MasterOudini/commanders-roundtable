// `Super Shredder` - a leavesBattlefield trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUPER_SHREDDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUPER_SHREDDER, "Menace\nWhenever another permanent leaves the battlefield, put a +1/+1 counter on Super Shredder.");
const LINES = PRINTED.split('\n');

export const SUPER_SHREDDER_SCRIPT: CardScript = {
  oracleId: SUPER_SHREDDER.oracleId,
  name: SUPER_SHREDDER.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind !== 'battlefield' && m.card !== self,
        ),
      label: () => "Super Shredder - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
