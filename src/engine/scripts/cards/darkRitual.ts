// `Dark Ritual` — "Add {B}{B}{B}." The FIRST mana-adding SpellDef: a spell
// that resolves into the pool through the same `ManaAdded` event a tapped
// land writes, source = the ritual itself so the log can say where the mana
// came from. The pool still empties at every step and phase boundary
// (CR 500.4) — nothing here changes that. D192.

import { DARK_RITUAL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { EMPTY_POOL } from '../../types/mana';

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

const TEXT = printed(DARK_RITUAL, 'Add {B}{B}{B}.');

export const DARK_RITUAL_SCRIPT: CardScript = {
  oracleId: DARK_RITUAL.oracleId,
  name: DARK_RITUAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, B: 3 }, source: self },
      ];
    },
  },
};
