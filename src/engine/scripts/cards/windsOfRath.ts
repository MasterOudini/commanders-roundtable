// `Winds of Rath` — destroy all creatures that AREN'T ENCHANTED.
//
// ⚠️ "Enchanted" means an AURA is attached to it, so the predicate is read
// from the other side: scan the battlefield for enchantments whose
// `attachedTo` names the creature. There is no `enchantedBy` field to read
// directly, which is why this is built as a set rather than a per-card flag.
//
// ⚠️ The printed line ends "They can't be regenerated." That phrase trips the
// drafts tripwire grep, but it is the CARD's own words — Damnation, Consume
// the Meek and Devour in Shadow all ship carrying it — and it costs the def
// nothing, because the engine has no regeneration to suppress. D269.

import { WINDS_OF_RATH } from '../../../data/fixtures/engineCards';
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
  WINDS_OF_RATH,
  "Destroy all creatures that aren't enchanted. They can't be regenerated.",
);

export const WINDS_OF_RATH_SCRIPT: CardScript = {
  oracleId: WINDS_OF_RATH.oracleId,
  name: WINDS_OF_RATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      // Every creature an Aura is currently attached to.
      const enchanted = new Set<InstanceId>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.attachedTo === null) continue;
        if (!ctx.derive(id).typeLine.types.includes('Enchantment')) continue;
        enchanted.add(card.attachedTo);
      }

      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (enchanted.has(id)) continue;
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
