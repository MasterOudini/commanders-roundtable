// `Archangel of Thune` - a youGainLife trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCHANGEL_OF_THUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCHANGEL_OF_THUNE, "Flying\nLifelink (Damage dealt by this creature also causes you to gain that much life.)\nWhenever you gain life, put a +1/+1 counter on each creature you control.");
const LINES = PRINTED.split('\n');

export const ARCHANGEL_OF_THUNE_SCRIPT: CardScript = {
  oracleId: ARCHANGEL_OF_THUNE.oracleId,
  name: ARCHANGEL_OF_THUNE.name,
  triggers: [
    {
      abilityId: 'youGainLife-2',
      text: LINES[2] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Archangel of Thune - a counter on each creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
