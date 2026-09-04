// `Ambush Paratrooper` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { AMBUSH_PARATROOPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMBUSH_PARATROOPER, "Flash\nFlying\n{5}: Creatures you control get +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const AMBUSH_PARATROOPER_SCRIPT: CardScript = {
  oracleId: AMBUSH_PARATROOPER.oracleId,
  name: AMBUSH_PARATROOPER.name,
  activated: [
    {
      ref: `${AMBUSH_PARATROOPER.oracleId}#a0`,
      text: LINES[2] as string,
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
