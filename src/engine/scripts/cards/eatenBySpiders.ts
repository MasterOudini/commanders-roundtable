// `Eaten by Spiders` — destroy the flyer and every Equipment attached to it
// (Blastfire Bolt's attachment walk, D-era). The flying restriction is the
// parser's and the validator's (D289); the sentence's "and all Equipment"
// continues past the qualifier, so the clause text ends at "with flying".

import { EATEN_BY_SPIDERS } from '../../../data/fixtures/engineCards';
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
  EATEN_BY_SPIDERS,
  'Destroy target creature with flying and all Equipment attached to that creature.',
);

export const EATEN_BY_SPIDERS_SCRIPT: CardScript = {
  oracleId: EATEN_BY_SPIDERS.oracleId,
  name: EATEN_BY_SPIDERS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const moves = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      for (const att of card.attachments) {
        const a = ctx.state.cards[att];
        if (!a || a.zone.kind !== 'battlefield') continue;
        const d = ctx.derive(att);
        if (!d.typeLine.subtypes.includes('Equipment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: att,
          from: { kind: 'battlefield' as const, player: a.controller },
          to: { kind: 'graveyard' as const, player: a.owner },
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
