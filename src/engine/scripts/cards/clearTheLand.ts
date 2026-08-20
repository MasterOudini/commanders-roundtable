// `Clear the Land` — "Each player reveals the top five cards of their
// library, puts all land cards revealed this way onto the battlefield
// tapped, and exiles the rest." Choiceless per player: the reveal is
// public, the sort reads ORACLE faces, the lands enter then the SPELL taps
// them (one PermanentsTapped batch). D203.

import { CLEAR_THE_LAND } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  CLEAR_THE_LAND,
  'Each player reveals the top five cards of their library, puts all land cards revealed this way onto the battlefield tapped, and exiles the rest.',
);

export const CLEAR_THE_LAND_SCRIPT: CardScript = {
  oracleId: CLEAR_THE_LAND.oracleId,
  name: CLEAR_THE_LAND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const landed: string[] = [];
      const reveals: string[] = [];
      const moves = [];
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        const lib = ctx.state.zones.library[pid] ?? [];
        const n = Math.min(5, lib.length);
        if (n === 0) continue;
        const top = lib.slice(lib.length - n);
        reveals.push(...top);
        for (const id of top) {
          const card = ctx.state.cards[id];
          const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
          const isLand = oc
            ? faceOf(oc, card?.faceIndex ?? 0).typeLine.types.includes('Land')
            : false;
          if (isLand) {
            landed.push(id);
            moves.push({
              card: id,
              from: { kind: 'library' as const, player: pid },
              to: { kind: 'battlefield' as const, player: pid },
            });
          } else {
            moves.push({
              card: id,
              from: { kind: 'library' as const, player: pid },
              to: { kind: 'exile' as const, player: card?.owner ?? pid },
            });
          }
        }
      }
      if (reveals.length === 0) return [];
      events.push({ t: 'CardsRevealed', cards: reveals, to: [...ctx.state.seating] });
      events.push({ t: 'CardsMoved', moves });
      if (landed.length > 0) events.push({ t: 'PermanentsTapped', cards: landed });
      return events;
    },
  },
};
