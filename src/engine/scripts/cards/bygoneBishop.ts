// `Bygone Bishop` - a castSpell trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BYGONE_BISHOP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BYGONE_BISHOP, "Flying\nWhenever you cast a creature spell with mana value 3 or less, investigate. (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Clue|/||Artifact|");

export const BYGONE_BISHOP_SCRIPT: CardScript = {
  oracleId: BYGONE_BISHOP.oracleId,
  name: BYGONE_BISHOP.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Creature') &&
        (ctx.derive(ev.obj.card).manaValue ?? 0) <= 3,
      label: () => "Bygone Bishop - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
