// `Tranquil Domain` — the negated-SUBTYPE wipe, one taxonomy level below
// D259's Their Name Is Death: every enchantment that is NOT an Aura.
//
// ⚠️ The filter reads the DERIVED type line, so an Aura is spared by its
// SUBTYPE and a global enchantment dies by not having it. Per-object
// indestructible, as every sweep since D192's Damnation. D261.

import { TRANQUIL_DOMAIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TRANQUIL_DOMAIN, 'Destroy all non-Aura enchantments.');

export const TRANQUIL_DOMAIN_SCRIPT: CardScript = {
  oracleId: TRANQUIL_DOMAIN.oracleId,
  name: TRANQUIL_DOMAIN.name,
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
        if (d.typeLine.subtypes.includes('Aura')) continue;
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
