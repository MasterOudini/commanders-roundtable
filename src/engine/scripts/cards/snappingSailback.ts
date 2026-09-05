// `Snapping Sailback` - a isDealtCombatDamage trigger selfCounter, a isDealtNoncombatDamage trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SNAPPING_SAILBACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SNAPPING_SAILBACK, "Flash\nEnrage — Whenever this creature is dealt damage, put a +1/+1 counter on it. (It must survive the damage to get the counter.)");
const LINES = PRINTED.split('\n');

export const SNAPPING_SAILBACK_SCRIPT: CardScript = {
  oracleId: SNAPPING_SAILBACK.oracleId,
  name: SNAPPING_SAILBACK.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Snapping Sailback - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-1',
      text: LINES[1] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Snapping Sailback - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
