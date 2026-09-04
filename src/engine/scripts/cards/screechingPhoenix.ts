// `Screeching Phoenix` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { SCREECHING_PHOENIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCREECHING_PHOENIX, "Flying\n{2}{R}: Creatures you control get +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const SCREECHING_PHOENIX_SCRIPT: CardScript = {
  oracleId: SCREECHING_PHOENIX.oracleId,
  name: SCREECHING_PHOENIX.name,
  activated: [
    {
      ref: `${SCREECHING_PHOENIX.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // Every creature its controller controls, as the board derives NOW.
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
