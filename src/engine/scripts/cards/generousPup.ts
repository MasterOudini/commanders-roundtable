// `Generous Pup` - a countersPutOnSelf trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GENEROUS_PUP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GENEROUS_PUP, "Vigilance\nWhenever one or more +1/+1 counters are put on this creature, put a +1/+1 counter on each other creature you control. This ability triggers only once each turn.");
const LINES = PRINTED.split('\n');

export const GENEROUS_PUP_SCRIPT: CardScript = {
  oracleId: GENEROUS_PUP.oracleId,
  name: GENEROUS_PUP.name,
  triggers: [
    {
      abilityId: 'countersPutOnSelf-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Generous Pup - a counter on each creature",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
