// `Kozilek's Sentinel` - a castSpell trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOZILEK_S_SENTINEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOZILEK_S_SENTINEL, "Devoid (This card has no color.)\nWhenever you cast a colorless spell, this creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const KOZILEKS_SENTINEL_SCRIPT: CardScript = {
  oracleId: KOZILEK_S_SENTINEL.oracleId,
  name: KOZILEK_S_SENTINEL.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.length === 0,
      label: () => "Kozilek's Sentinel - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
