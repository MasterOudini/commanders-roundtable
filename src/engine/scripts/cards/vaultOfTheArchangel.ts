// `Vault of the Archangel` - a one-shot pump on its controller's creatures until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { VAULT_OF_THE_ARCHANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAULT_OF_THE_ARCHANGEL, "{T}: Add {C}.\n{2}{W}{B}, {T}: Creatures you control gain deathtouch and lifelink until end of turn.");
const LINES = PRINTED.split('\n');

export const VAULT_OF_THE_ARCHANGEL_SCRIPT: CardScript = {
  oracleId: VAULT_OF_THE_ARCHANGEL.oracleId,
  name: VAULT_OF_THE_ARCHANGEL.name,
  activated: [
    {
      ref: `${VAULT_OF_THE_ARCHANGEL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // Every creature its controller controls, as the board derives NOW.
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["deathtouch", "lifelink"] });
        }
        return out;
      },
    },
  ],
};
