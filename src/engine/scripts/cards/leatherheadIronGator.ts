// `Leatherhead, Iron Gator` - a attacks trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEATHERHEAD_IRON_GATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEATHERHEAD_IRON_GATOR, "Trample, haste\nWhenever Leatherhead attacks, put two +1/+1 counters on each creature you control.");
const LINES = PRINTED.split('\n');

export const LEATHERHEAD_IRON_GATOR_SCRIPT: CardScript = {
  oracleId: LEATHERHEAD_IRON_GATOR.oracleId,
  name: LEATHERHEAD_IRON_GATOR.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Leatherhead, Iron Gator - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 2 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
