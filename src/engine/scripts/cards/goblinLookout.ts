// `Goblin Lookout` - an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_LOOKOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_LOOKOUT, "{T}, Sacrifice a Goblin: Goblin creatures get +2/+0 until end of turn.");

export const GOBLIN_LOOKOUT_SCRIPT: CardScript = {
  oracleId: GOBLIN_LOOKOUT.oracleId,
  name: GOBLIN_LOOKOUT.name,
  activated: [
    {
      ref: `${GOBLIN_LOOKOUT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, _obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield') continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Goblin")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
