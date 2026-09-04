// `Conclave Guildmage` - an activation pumping its controller's creatures, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONCLAVE_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONCLAVE_GUILDMAGE, "{G}, {T}: Creatures you control gain trample until end of turn.\n{5}{W}, {T}: Create a 2/2 green and white Elf Knight creature token with vigilance.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Elf Knight|2/2|GW|Creature|vigilance");

export const CONCLAVE_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: CONCLAVE_GUILDMAGE.oracleId,
  name: CONCLAVE_GUILDMAGE.name,
  activated: [
    {
      ref: `${CONCLAVE_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["trample"] });
        }
        return out;
      },
    },
    {
      ref: `${CONCLAVE_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_1.oracleId,
          printingId: TOKEN_1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
