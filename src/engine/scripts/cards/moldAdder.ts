// `Mold Adder` - a opponentCastsSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLD_ADDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLD_ADDER, "Whenever an opponent casts a blue or black spell, you may put a +1/+1 counter on this creature.");

export const MOLD_ADDER_SCRIPT: CardScript = {
  oracleId: MOLD_ADDER.oracleId,
  name: MOLD_ADDER.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).colors.includes('U') || ctx.derive(ev.obj.card).colors.includes('B')),
      label: () => "Mold Adder - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
