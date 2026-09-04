// `Aron, Benalia's Ruin` - an activation massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARON_BENALIA_S_RUIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARON_BENALIA_S_RUIN, "Menace (This creature can't be blocked except by two or more creatures.)\n{W}{B}, {T}, Sacrifice another creature: Put a +1/+1 counter on each creature you control.");
const LINES = PRINTED.split('\n');

export const ARON_BENALIAS_RUIN_SCRIPT: CardScript = {
  oracleId: ARON_BENALIA_S_RUIN.oracleId,
  name: ARON_BENALIA_S_RUIN.name,
  activated: [
    {
      ref: `${ARON_BENALIA_S_RUIN.oracleId}#a0`,
      text: LINES[1] as string,
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
