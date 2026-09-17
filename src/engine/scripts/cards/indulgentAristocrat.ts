// `Indulgent Aristocrat` - an activation massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INDULGENT_ARISTOCRAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INDULGENT_ARISTOCRAT, "Lifelink\n{2}, Sacrifice a creature: Put a +1/+1 counter on each Vampire you control.");
const LINES = PRINTED.split('\n');

export const INDULGENT_ARISTOCRAT_SCRIPT: CardScript = {
  oracleId: INDULGENT_ARISTOCRAT.oracleId,
  name: INDULGENT_ARISTOCRAT.name,
  activated: [
    {
      ref: `${INDULGENT_ARISTOCRAT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Vampire")) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
