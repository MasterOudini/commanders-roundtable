// `Unified Strike` — exile the attacker only if its (derived) power is at
// most the number of Soldiers on the battlefield, any controller; otherwise
// the spell resolves and does nothing. D291's role.

import { UNIFIED_STRIKE } from '../../../data/fixtures/engineCards';
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
  UNIFIED_STRIKE,
  'Exile target attacking creature if its power is less than or equal to the number of Soldiers on the battlefield.',
);

export const UNIFIED_STRIKE_SCRIPT: CardScript = {
  oracleId: UNIFIED_STRIKE.oracleId,
  name: UNIFIED_STRIKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      let soldiers = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.derive(id).typeLine.subtypes.includes('Soldier')) soldiers++;
      }
      const power = ctx.derive(target.id).power ?? 0;
      if (power > soldiers) return [];
      return [
        {
          t: 'CardsMoved',
          moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'exile', player: card.owner } }],
        },
      ];
    },
  },
};
