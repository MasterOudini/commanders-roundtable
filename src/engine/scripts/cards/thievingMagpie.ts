// `Thieving Magpie` — Thieving Otter's EXACT ability text on a second oracle
// id, behind a flying keyword line the engine already enforces. Two defs for
// the same reason: the printed word is "damage", not "combat damage", and
// `CombatDamageDealt` / `DamageDealt` are disjoint (see thievingOtter.ts for
// the measurement). D259.

import { THIEVING_MAGPIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  THIEVING_MAGPIE,
  "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever this creature deals damage to an opponent, draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

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

export const THIEVING_MAGPIE_SCRIPT: CardScript = {
  oracleId: THIEVING_MAGPIE.oracleId,
  name: THIEVING_MAGPIE.name,
  triggers: [
    {
      abilityId: 'connects-combat',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && hitAnOpponent(ctx, self, ev.damages),
      label: () => 'Thieving Magpie — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => draw(ctx, obj),
    },
    {
      abilityId: 'connects-noncombat',
      text: TEXT,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && hitAnOpponent(ctx, self, ev.damages),
      label: () => 'Thieving Magpie — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => draw(ctx, obj),
    },
  ],
};
