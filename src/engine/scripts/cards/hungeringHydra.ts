// `Hungering Hydra` - a static entersWithCountersX, a static maxBlockers, a isDealtCombatDamage trigger vocab, a isDealtNoncombatDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HUNGERING_HYDRA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(HUNGERING_HYDRA, "This creature enters with X +1/+1 counters on it.\nThis creature can't be blocked by more than one creature.\nWhenever this creature is dealt damage, put that many +1/+1 counters on it. (It must survive the damage to get the counters.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put that many +1/+1 counters on ~.", HUNGERING_HYDRA.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("Put that many +1/+1 counters on ~.");

export const HUNGERING_HYDRA_SCRIPT: CardScript = {
  oracleId: HUNGERING_HYDRA.oracleId,
  name: HUNGERING_HYDRA.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Hungering Hydra - Put that many +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-2',
      text: LINES[2] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Hungering Hydra - Put that many +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  combat: [
    {
      abilityId: 'maxBlockers-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      maxBlockers: (_ctx, self, attacker) => (attacker === self ? 1 : null),
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (ctx, self, ev): readonly EventBody[] => {
        // The cast's X, read off the stack object the spell still is (CR 608.2).
        const x = ctx.state.stack.find((o) => o.card === self)?.xValue ?? 0;
        return x > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: x }] }] : [ev];
      },
    },
  ],
};
