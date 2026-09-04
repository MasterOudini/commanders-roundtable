// `Sunhome Guildmage` - an activation pumping its controller's creatures, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNHOME_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNHOME_GUILDMAGE, "{1}{R}{W}: Creatures you control get +1/+0 until end of turn.\n{2}{R}{W}: Create a 1/1 red and white Soldier creature token with haste.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Soldier|1/1|RW|Creature|haste");

export const SUNHOME_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: SUNHOME_GUILDMAGE.oracleId,
  name: SUNHOME_GUILDMAGE.name,
  activated: [
    {
      ref: `${SUNHOME_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0 });
        }
        return out;
      },
    },
    {
      ref: `${SUNHOME_GUILDMAGE.oracleId}#a1`,
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
