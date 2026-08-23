// `Tranquility` — the unfiltered twin beside Tranquil Domain in the same
// batch: every enchantment, Aura or not. Landing the pair together is what
// makes the negation in the other one an assertion rather than a claim. D261.

import { TRANQUILITY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TRANQUILITY, 'Destroy all enchantments.');

export const TRANQUILITY_SCRIPT: CardScript = {
  oracleId: TRANQUILITY.oracleId,
  name: TRANQUILITY.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'graveyard'; player: string };
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: inst.controller },
          to: { kind: 'graveyard', player: inst.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
