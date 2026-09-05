// `Bellowing Aegisaur` - a isDealtCombatDamage trigger massCounter, a isDealtNoncombatDamage trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELLOWING_AEGISAUR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
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

const PRINTED = printed(BELLOWING_AEGISAUR, "Enrage — Whenever this creature is dealt damage, put a +1/+1 counter on each other creature you control.");

export const BELLOWING_AEGISAUR_SCRIPT: CardScript = {
  oracleId: BELLOWING_AEGISAUR.oracleId,
  name: BELLOWING_AEGISAUR.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Bellowing Aegisaur - a counter on each creature",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-0',
      text: PRINTED,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Bellowing Aegisaur - a counter on each creature",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
