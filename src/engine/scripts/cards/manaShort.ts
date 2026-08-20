// `Mana Short` — every land the target controls turns, and their pool
// empties (ManaPoolEmptied is the reducer's own set-to-empty). D223.

import { MANA_SHORT } from '../../../data/fixtures/engineCards';
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
  MANA_SHORT,
  'Tap all lands target player controls and that player loses all unspent mana.',
);

export const MANA_SHORT_SCRIPT: CardScript = {
  oracleId: MANA_SHORT.oracleId,
  name: MANA_SHORT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const lands = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id || card.tapped) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) lands.push(id);
      }
      const events: EventBody[] = [];
      if (lands.length > 0) events.push({ t: 'PermanentsTapped', cards: lands });
      events.push({ t: 'ManaPoolEmptied', player: target.id, lost: p.pool });
      return events;
    },
  },
};
