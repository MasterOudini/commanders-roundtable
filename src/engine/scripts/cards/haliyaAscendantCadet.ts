// `Haliya, Ascendant Cadet` — "Whenever Haliya enters or attacks, put a
// +1/+1 counter on target creature you control.\nWhenever one or more
// creatures you control with +1/+1 counters on them deal combat damage to a
// player, draw a card." Haazda Vigilante's enters-or-attacks PAIR (two defs,
// one printed line, each aimed by the parsed spec) and Keeper of Fables'
// batch combat-damage watcher with the predicate asked of each damage
// SOURCE — a creature I control carrying at least one +1/+1 counter. "One or
// more" is a batch match, never a per-item fan-out (D185). D276.

import { HALIYA_ASCENDANT_CADET } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';

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
  HALIYA_ASCENDANT_CADET,
  'Whenever Haliya enters or attacks, put a +1/+1 counter on target creature you control.\nWhenever one or more creatures you control with +1/+1 counters on them deal combat damage to a player, draw a card.',
);
const COUNTER = PRINTED.split('\n')[0] as string;
const HIT = PRINTED.split('\n')[1] as string;

function counterOn(ctx: ScriptCtx, obj: StackObject): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
    ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
    : [];
}

export const HALIYA_ASCENDANT_CADET_SCRIPT: CardScript = {
  oracleId: HALIYA_ASCENDANT_CADET.oracleId,
  name: HALIYA_ASCENDANT_CADET.name,
  triggers: [
    {
      abilityId: 'enters',
      text: COUNTER,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(COUNTER),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Haliya, Ascendant Cadet — +1/+1 counter on a creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => counterOn(ctx, obj),
    },
    {
      abilityId: 'attacks',
      text: COUNTER,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(COUNTER),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Haliya, Ascendant Cadet — +1/+1 counter on a creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => counterOn(ctx, obj),
    },
    {
      abilityId: 'countered-hit',
      text: HIT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => {
          if (d.target.kind !== 'player' || d.amount <= 0) return false;
          const inst = ctx.state.cards[d.source];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          if ((inst.counters['+1/+1'] ?? 0) <= 0) return false;
          return ctx.derive(d.source).typeLine.types.includes('Creature');
        }),
      label: () => 'Haliya, Ascendant Cadet — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
