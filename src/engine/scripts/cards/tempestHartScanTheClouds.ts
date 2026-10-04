// `Tempest Hart // Scan the Clouds` - a castSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEMPEST_HART_SCAN_THE_CLOUDS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(TEMPEST_HART_SCAN_THE_CLOUDS, "Trample\nWhenever you cast a spell with mana value 5 or greater, put a +1/+1 counter on this creature.\nDraw two cards, then discard two cards. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const TEMPEST_HART_SCAN_THE_CLOUDS_SCRIPT: CardScript = {
  oracleId: TEMPEST_HART_SCAN_THE_CLOUDS.oracleId,
  name: TEMPEST_HART_SCAN_THE_CLOUDS.name,
  triggers: [
    {
      abilityId: 'castSpell-1', face: 0,
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).manaValue ?? 0) >= 5,
      label: () => "Tempest Hart // Scan the Clouds - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
