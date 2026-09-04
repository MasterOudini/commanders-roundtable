// `Encampment Keeper` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { ENCAMPMENT_KEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ENCAMPMENT_KEEPER, "First strike\n{7}{W}, {T}, Sacrifice this creature: Creatures you control get +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const ENCAMPMENT_KEEPER_SCRIPT: CardScript = {
  oracleId: ENCAMPMENT_KEEPER.oracleId,
  name: ENCAMPMENT_KEEPER.name,
  activated: [
    {
      ref: `${ENCAMPMENT_KEEPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // Every creature its controller controls, as the board derives NOW.
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 2 });
        }
        return out;
      },
    },
  ],
};
