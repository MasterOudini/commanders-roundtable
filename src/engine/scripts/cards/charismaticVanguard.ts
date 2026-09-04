// `Charismatic Vanguard` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { CHARISMATIC_VANGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHARISMATIC_VANGUARD, "{4}{W}: Creatures you control get +1/+1 until end of turn.");

export const CHARISMATIC_VANGUARD_SCRIPT: CardScript = {
  oracleId: CHARISMATIC_VANGUARD.oracleId,
  name: CHARISMATIC_VANGUARD.name,
  activated: [
    {
      ref: `${CHARISMATIC_VANGUARD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // Every creature its controller controls, as the board derives NOW.
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
