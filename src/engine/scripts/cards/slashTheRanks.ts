// `Slash the Ranks` — "Destroy all creatures and planeswalkers except for
// commanders." The first wipe that reads COMMANDER IDENTITY: every player's
// `commanderIds` is consulted, so a partner pair is two exemptions and a
// stolen commander is still exempt (the ids are instance ids, not names).
// Creatures AND planeswalkers by derived types; indestructible survives. D192.

import { SLASH_THE_RANKS } from '../../../data/fixtures/engineCards';
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
  SLASH_THE_RANKS,
  'Destroy all creatures and planeswalkers except for commanders.',
);

export const SLASH_THE_RANKS_SCRIPT: CardScript = {
  oracleId: SLASH_THE_RANKS.oracleId,
  name: SLASH_THE_RANKS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const commanders = new Set<string>();
      for (const p of Object.values(ctx.state.players)) {
        for (const id of p.commanderIds) commanders.add(id);
      }
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || commanders.has(id)) continue;
        const d = ctx.derive(id);
        const types = d.typeLine.types;
        if (!types.includes('Creature') && !types.includes('Planeswalker')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
