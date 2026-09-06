// `Red Ghost, Intangible Genius` - a static cantBeBlocked, a secondCard trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RED_GHOST_INTANGIBLE_GENIUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RED_GHOST_INTANGIBLE_GENIUS, "Ward {2}\nRed Ghost can't be blocked.\nWhenever you draw your second card each turn, create a 3/3 red Ape Villain creature token with haste.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Ape Villain|3/3|R|Creature|haste");

export const RED_GHOST_INTANGIBLE_GENIUS_SCRIPT: CardScript = {
  oracleId: RED_GHOST_INTANGIBLE_GENIUS.oracleId,
  name: RED_GHOST_INTANGIBLE_GENIUS.name,
  triggers: [
    {
      abilityId: 'secondCard-2',
      text: LINES[2] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Red Ghost, Intangible Genius - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlocked-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
