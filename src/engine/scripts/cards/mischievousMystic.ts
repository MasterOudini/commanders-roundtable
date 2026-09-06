// `Mischievous Mystic` - a secondCard trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISCHIEVOUS_MYSTIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MISCHIEVOUS_MYSTIC, "Flying\nWhenever you draw your second card each turn, create a 1/1 blue Faerie creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Faerie|1/1|U|Creature|flying");

export const MISCHIEVOUS_MYSTIC_SCRIPT: CardScript = {
  oracleId: MISCHIEVOUS_MYSTIC.oracleId,
  name: MISCHIEVOUS_MYSTIC.name,
  triggers: [
    {
      abilityId: 'secondCard-1',
      text: LINES[1] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Mischievous Mystic - token",
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
