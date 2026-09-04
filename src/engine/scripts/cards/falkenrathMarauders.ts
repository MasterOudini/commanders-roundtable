// `Falkenrath Marauders` - a combatDamagePlayer trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FALKENRATH_MARAUDERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FALKENRATH_MARAUDERS, "Flying\nHaste (This creature can attack and {T} as soon as it comes under your control.)\nWhenever this creature deals combat damage to a player, put two +1/+1 counters on it.");
const LINES = PRINTED.split('\n');

export const FALKENRATH_MARAUDERS_SCRIPT: CardScript = {
  oracleId: FALKENRATH_MARAUDERS.oracleId,
  name: FALKENRATH_MARAUDERS.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Falkenrath Marauders - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
};
