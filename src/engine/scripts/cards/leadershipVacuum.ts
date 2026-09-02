// `Leadership Vacuum` — "Target player returns each commander they control
// from the battlefield to the command zone.\nDraw a card." The command zone
// is a real zone here (CardsMoved to `command`) and a commander is a real
// flag on the card (`isCommander`, state.ts) — so the resolve walks the
// targeted player's battlefield for commanders and sends each home, then I
// draw. The move goes straight to the zone rather than through the CR 903.9
// replacement prompt: the card says "returns", not "would be put". D277.

import { LEADERSHIP_VACUUM } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  LEADERSHIP_VACUUM,
  'Target player returns each commander they control from the battlefield to the command zone.\nDraw a card.',
);

export const LEADERSHIP_VACUUM_SCRIPT: CardScript = {
  oracleId: LEADERSHIP_VACUUM.oracleId,
  name: LEADERSHIP_VACUUM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const them = ctx.state.players[target.id];
      if (!them || them.hasLost) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id || !card.isCommander) continue;
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'command', player: card.owner },
            },
          ],
        });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
