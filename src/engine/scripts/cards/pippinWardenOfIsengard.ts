// `Pippin, Warden of Isengard` - an activation token, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PIPPIN_WARDEN_OF_ISENGARD } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(PIPPIN_WARDEN_OF_ISENGARD, "Partner with Merry, Warden of Isengard (When this creature enters, target player may put Merry into their hand from their library, then shuffle.)\n{1}, {T}: Create a Food token.\n{T}, Sacrifice four Foods: Other creatures you control get +3/+3 and gain haste until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Food|/||Artifact|");

export const PIPPIN_WARDEN_OF_ISENGARD_SCRIPT: CardScript = {
  oracleId: PIPPIN_WARDEN_OF_ISENGARD.oracleId,
  name: PIPPIN_WARDEN_OF_ISENGARD.name,
  activated: [
    {
      ref: `${PIPPIN_WARDEN_OF_ISENGARD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
    {
      ref: `${PIPPIN_WARDEN_OF_ISENGARD.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 3, toughness: 3, keywords: ["haste"] });
        }
        return out;
      },
    },
  ],
};
