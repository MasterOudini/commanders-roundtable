// `Thieving Otter` — the connect-draw, and TWO defs rather than one.
//
// ⚠️ THE PRINTED WORD IS "DAMAGE", NOT "COMBAT DAMAGE". Scroll Thief (D244)
// says "combat damage" and watches `CombatDamageDealt` alone; this card does
// not, so a ping or a fight has to pay too. MEASURED: the two events are
// DISJOINT — `loop.ts` emits `CombatDamageDealt` for combat and
// `effects.ts` emits `DamageDealt` for everything else, and neither emits the
// other — so two defs cover the whole card with no risk of double-firing.
// A combat-only version would have under-fired silently on every ping.
//
// ⚠️ And "an OPPONENT", not "a player": damage to myself pays nothing, which
// is why the controller is read rather than just the target kind. D259.

import { THIEVING_OTTER } from '../../../data/fixtures/engineCards';
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
  THIEVING_OTTER,
  'Whenever this creature deals damage to an opponent, draw a card.',
);

/** This creature dealt damage to a player who is not its controller. */
function hitAnOpponent(
  ctx: ScriptCtx,
  self: InstanceId,
  damages: readonly { source: string; target: { kind: string; id: string }; amount: number }[],
): boolean {
  const mine = ctx.query.controllerOf(self);
  return damages.some(
    (d) => d.source === self && d.target.kind === 'player' && d.target.id !== mine && d.amount > 0,
  );
}

function draw(ctx: ScriptCtx, obj: { controller: string }): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player || player.hasLost) return [];
  return [...drawEvents(ctx.state, obj.controller, 1)];
}

export const THIEVING_OTTER_SCRIPT: CardScript = {
  oracleId: THIEVING_OTTER.oracleId,
  name: THIEVING_OTTER.name,
  triggers: [
    {
      abilityId: 'connects-combat',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && hitAnOpponent(ctx, self, ev.damages),
      label: () => 'Thieving Otter — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => draw(ctx, obj),
    },
    {
      abilityId: 'connects-noncombat',
      text: TEXT,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && hitAnOpponent(ctx, self, ev.damages),
      label: () => 'Thieving Otter — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => draw(ctx, obj),
    },
  ],
};
