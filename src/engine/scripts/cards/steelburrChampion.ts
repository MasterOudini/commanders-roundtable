// `Steelburr Champion` - a opponentCastsSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELBURR_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELBURR_CHAMPION, "Offspring {1}{W} (You may pay an additional {1}{W} as you cast this spell. If you do, when this creature enters, create a 1/1 token copy of it.)\nVigilance\nWhenever an opponent casts a noncreature spell, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const STEELBURR_CHAMPION_SCRIPT: CardScript = {
  oracleId: STEELBURR_CHAMPION.oracleId,
  name: STEELBURR_CHAMPION.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Steelburr Champion - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
