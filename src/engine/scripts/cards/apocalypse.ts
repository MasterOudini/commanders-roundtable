// `Apocalypse` — "Exile all permanents. You discard your hand." One
// simultaneous CardsMoved per sentence: exile is not destruction, so
// indestructible does NOT survive it, and the whole hand is a choiceless
// discard (Wheel of Fortune's rule, D196). Tokens go too — the SBA ceases
// them once they leave the battlefield. D198.

import { APOCALYPSE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(APOCALYPSE, 'Exile all permanents. You discard your hand.');

export const APOCALYPSE_SCRIPT: CardScript = {
  oracleId: APOCALYPSE.oracleId,
  name: APOCALYPSE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const exiles = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        exiles.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (exiles.length > 0) events.push({ t: 'CardsMoved', moves: exiles });
      const discards = [];
      for (const id of ctx.state.zones.hand[obj.controller] ?? []) {
        discards.push({
          card: id,
          from: { kind: 'hand' as const, player: obj.controller },
          to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? obj.controller },
        });
      }
      if (discards.length > 0) events.push({ t: 'CardsMoved', moves: discards });
      return events;
    },
  },
};
