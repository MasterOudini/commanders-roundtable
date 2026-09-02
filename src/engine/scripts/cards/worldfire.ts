// `Worldfire` — exile every permanent, every hand and every graveyard, then
// set each life total TO 1.
//
// ⚠️ The biggest board-wipe in the arc, and it lands for one reason: there is
// no CHOICE anywhere in it. Everything is a mechanical sweep, and "life total
// BECOMES 1" is a `LifeChanged` with an absolute `to` and a computed delta —
// not a loss of N, which is why a player already at 1 is untouched and a
// player at 40 drops 39.
//
// ⚠️ Every zone is read BEFORE any move is emitted; a resolve cannot see its
// own effects (sixth outing), and all the moves go in ONE `CardsMoved`.
// D270.

import { WORLDFIRE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  WORLDFIRE,
  "Exile all permanents. Exile all cards from all hands and graveyards. Each player's life total becomes 1.",
);

export const WORLDFIRE_SCRIPT: CardScript = {
  oracleId: WORLDFIRE.oracleId,
  name: WORLDFIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield' | 'hand' | 'graveyard'; player: string };
        to: { kind: 'exile'; player: string };
      }[] = [];

      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'exile', player: card.owner },
        });
      }

      for (const p of ctx.state.seating) {
        for (const [zone, ids] of [
          ['hand', ctx.state.zones.hand[p] ?? []],
          ['graveyard', ctx.state.zones.graveyard[p] ?? []],
        ] as const) {
          for (const id of ids) {
            const card = ctx.state.cards[id];
            if (!card) continue;
            moves.push({
              card: id,
              from: { kind: zone, player: p },
              to: { kind: 'exile', player: card.owner },
            });
          }
        }
      }

      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });

      for (const p of ctx.state.seating) {
        const player = ctx.state.players[p];
        if (!player || player.hasLost) continue;
        if (player.life === 1) continue;
        events.push({ t: 'LifeChanged', player: p, delta: 1 - player.life, to: 1 });
      }
      return events;
    },
  },
};
