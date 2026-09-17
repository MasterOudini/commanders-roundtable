// `Agent Phil Coulson` - an activation massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGENT_PHIL_COULSON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGENT_PHIL_COULSON, "Vigilance\n{T}: Put a +1/+1 counter on each other Hero you control.");
const LINES = PRINTED.split('\n');

export const AGENT_PHIL_COULSON_SCRIPT: CardScript = {
  oracleId: AGENT_PHIL_COULSON.oracleId,
  name: AGENT_PHIL_COULSON.name,
  activated: [
    {
      ref: `${AGENT_PHIL_COULSON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Hero")) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
