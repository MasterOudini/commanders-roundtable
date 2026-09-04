// `Pyroceratops` - a castNoncreature trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYROCERATOPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYROCERATOPS, "Trample\nWhenever you cast a noncreature spell, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const PYROCERATOPS_SCRIPT: CardScript = {
  oracleId: PYROCERATOPS.oracleId,
  name: PYROCERATOPS.name,
  triggers: [
    {
      abilityId: 'castNoncreature-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Pyroceratops - creatures you control pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
