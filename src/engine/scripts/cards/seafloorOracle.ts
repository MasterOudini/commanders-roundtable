// `Seafloor Oracle` — "Whenever a Merfolk you control deals combat
// damage to a player, draw a card." The SEVENTH perItem consumer: one
// draw per connecting Merfolk, the dealer typed derived. D244.

import { SEAFLOOR_ORACLE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(
  SEAFLOOR_ORACLE,
  'Whenever a Merfolk you control deals combat damage to a player, draw a card.',
);

function qualifies(ctx: ScriptCtx, self: InstanceId, dealer: InstanceId): boolean {
  const inst = ctx.state.cards[dealer];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(dealer).typeLine.subtypes.includes('Merfolk');
}

export const SEAFLOOR_ORACLE_SCRIPT: CardScript = {
  oracleId: SEAFLOOR_ORACLE.oracleId,
  name: SEAFLOOR_ORACLE.name,
  triggers: [
    {
      abilityId: 'merfolk-hit-draw',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some(
          (d) => d.target.kind === 'player' && d.amount > 0 && qualifies(ctx, self, d.source),
        ),
      // One firing PER connecting Merfolk.
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt'
          ? ev.damages
              .filter(
                (d) =>
                  d.target.kind === 'player' && d.amount > 0 && qualifies(ctx, self, d.source),
              )
              .map((d) => d.source)
          : [],
      label: () => 'Seafloor Oracle — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
