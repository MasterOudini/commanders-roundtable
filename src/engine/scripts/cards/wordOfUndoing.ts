// `Word of Undoing` — return the target creature AND every WHITE Aura I OWN
// attached to it.
//
// ⚠️ Three filters on the Auras, and all three matter: attached to THIS
// creature, WHITE (derived colour), and owned by ME — not merely controlled.
// The attachment is read from the ATTACHER's side because there is no
// `enchantedBy` field (D269's Winds of Rath). ⚠️ And the Auras must be
// collected BEFORE the creature moves: a resolve cannot see its own effects,
// but both moves go in ONE `CardsMoved`, so the reads all happen up front.
// D270.

import { WORD_OF_UNDOING } from '../../../data/fixtures/engineCards';
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
  WORD_OF_UNDOING,
  "Return target creature and all white Auras you own attached to it to their owners' hands.",
);

export const WORD_OF_UNDOING_SCRIPT: CardScript = {
  oracleId: WORD_OF_UNDOING.oracleId,
  name: WORD_OF_UNDOING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];

      const moves = [
        {
          card: target.id,
          from: { kind: 'battlefield' as const, player: victim.controller },
          to: { kind: 'hand' as const, player: victim.owner },
        },
      ];

      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.attachedTo !== target.id) continue;
        if (card.owner !== obj.controller) continue; // "you OWN"
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        if (!d.typeLine.subtypes.includes('Aura')) continue;
        if (!d.colors.includes('W')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }

      return [{ t: 'CardsMoved', moves }];
    },
  },
};
