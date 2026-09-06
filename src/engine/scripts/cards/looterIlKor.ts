// `Looter il-Kor` - a dealsDamageOpponent trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOOTER_IL_KOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOOTER_IL_KOR, "Shadow (This creature can block or be blocked by only creatures with shadow.)\nWhenever this creature deals damage to an opponent, draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const LOOTER_IL_KOR_SCRIPT: CardScript = {
  oracleId: LOOTER_IL_KOR.oracleId,
  name: LOOTER_IL_KOR.name,
  triggers: [
    {
      abilityId: 'dealsDamageOpponent-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Looter il-Kor - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Looter il-Kor - discard a card" } },
        ];
      },
    },
    {
      abilityId: 'dealsDamageOpponentAny-1',
      text: LINES[1] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Looter il-Kor - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Looter il-Kor - discard a card" } },
        ];
      },
    },
  ],
};
