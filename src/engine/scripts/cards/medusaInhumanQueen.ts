// `Medusa, Inhuman Queen` - a castSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MEDUSA_INHUMAN_QUEEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MEDUSA_INHUMAN_QUEEN, "Vigilance, reach\nWhenever a player casts a noncreature spell, put a +1/+1 counter on Medusa.");
const LINES = PRINTED.split('\n');

export const MEDUSA_INHUMAN_QUEEN_SCRIPT: CardScript = {
  oracleId: MEDUSA_INHUMAN_QUEEN.oracleId,
  name: MEDUSA_INHUMAN_QUEEN.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Medusa, Inhuman Queen - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
