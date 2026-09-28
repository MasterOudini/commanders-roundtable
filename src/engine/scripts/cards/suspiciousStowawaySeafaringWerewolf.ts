// `Suspicious Stowaway // Seafaring Werewolf` - a static cantBeBlocked, a combatDamagePlayer trigger loot, a combatDamagePlayer trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUSPICIOUS_STOWAWAY_SEAFARING_WEREWOLF } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SUSPICIOUS_STOWAWAY_SEAFARING_WEREWOLF, "This creature can't be blocked.\nWhenever this creature deals combat damage to a player, draw a card, then discard a card.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nThis creature can't be blocked.\nWhenever this creature deals combat damage to a player, draw a card.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

export const SUSPICIOUS_STOWAWAY_SEAFARING_WEREWOLF_SCRIPT: CardScript = {
  oracleId: SUSPICIOUS_STOWAWAY_SEAFARING_WEREWOLF.oracleId,
  name: SUSPICIOUS_STOWAWAY_SEAFARING_WEREWOLF.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1', face: 0,
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Suspicious Stowaway // Seafaring Werewolf - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Suspicious Stowaway // Seafaring Werewolf - discard a card" } },
        ];
      },
    },
    {
      abilityId: 'combatDamagePlayer-4', face: 1,
      text: LINES[4] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Suspicious Stowaway // Seafaring Werewolf - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlocked-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
