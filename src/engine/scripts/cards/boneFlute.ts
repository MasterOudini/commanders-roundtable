// `Bone Flute` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { BONE_FLUTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BONE_FLUTE, "{2}, {T}: All creatures get -1/-0 until end of turn.");

export const BONE_FLUTE_SCRIPT: CardScript = {
  oracleId: BONE_FLUTE.oracleId,
  name: BONE_FLUTE.name,
  activated: [
    {
      ref: `${BONE_FLUTE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, _obj): readonly EventBody[] => {
        // Every creature on the battlefield, as the board derives NOW.
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield') continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: -1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
