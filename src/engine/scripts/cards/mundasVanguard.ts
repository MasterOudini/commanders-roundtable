// `Munda's Vanguard` - an activation massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MUNDA_S_VANGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MUNDA_S_VANGUARD, "Cohort — {T}, Tap an untapped Ally you control: Put a +1/+1 counter on each creature you control.");

export const MUNDAS_VANGUARD_SCRIPT: CardScript = {
  oracleId: MUNDA_S_VANGUARD.oracleId,
  name: MUNDA_S_VANGUARD.name,
  activated: [
    {
      ref: `${MUNDA_S_VANGUARD.oracleId}#a0`,
      text: PRINTED,
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
