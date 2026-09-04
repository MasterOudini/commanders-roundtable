// `Slith Strider` - a becomesBlocked trigger draw, a combatDamagePlayer trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLITH_STRIDER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SLITH_STRIDER, "Whenever this creature becomes blocked, draw a card.\nWhenever this creature deals combat damage to a player, put a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

export const SLITH_STRIDER_SCRIPT: CardScript = {
  oracleId: SLITH_STRIDER.oracleId,
  name: SLITH_STRIDER.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self),
      label: () => "Slith Strider - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Slith Strider - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
