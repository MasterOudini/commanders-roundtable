// `Battershield Warrior` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTERSHIELD_WARRIOR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(BATTERSHIELD_WARRIOR, "Boast — {1}{W}: Creatures you control get +1/+1 until end of turn. (Activate only if this creature attacked this turn and only once each turn.)");

export const BATTERSHIELD_WARRIOR_SCRIPT: CardScript = {
  oracleId: BATTERSHIELD_WARRIOR.oracleId,
  name: BATTERSHIELD_WARRIOR.name,
  activated: [
    {
      ref: `${BATTERSHIELD_WARRIOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1 });
        }
        return out;
      },
    },
  ],
};
