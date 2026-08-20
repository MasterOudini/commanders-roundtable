// `No Witnesses` — "Each player who controls the most creatures
// investigates. Then destroy all creatures." The most-creatures census
// (ties included) pays Clues BEFORE the wipe empties the count. D229.

import { NO_WITNESSES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  NO_WITNESSES,
  'Each player who controls the most creatures investigates. Then destroy all creatures. ' +
    '(To investigate, create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const NO_WITNESSES_SCRIPT: CardScript = {
  oracleId: NO_WITNESSES.oracleId,
  name: NO_WITNESSES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const counts = new Map<string, number>();
      for (const seat of ctx.state.seating) {
        const p = ctx.state.players[seat];
        if (!p || p.hasLost) continue;
        counts.set(seat, 0);
      }
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || !counts.has(card.controller)) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        counts.set(card.controller, (counts.get(card.controller) ?? 0) + 1);
      }
      const most = Math.max(0, ...counts.values());
      const events: EventBody[] = [];
      if (most > 0) {
        for (const [seat, n] of counts) {
          if (n !== most) continue;
          events.push({
            t: 'TokenCreated',
            card: ctx.ids.nextInstance(),
            oracleId: CLUE.oracleId,
            printingId: CLUE.printingId,
            controller: seat,
            owner: seat,
            turnNumber: ctx.state.turn.turnNumber,
          });
        }
      }
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
