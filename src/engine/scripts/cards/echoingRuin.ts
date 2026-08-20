// `Echoing Ruin` — "Destroy target artifact and all other artifacts with
// the same name as that artifact." Echoing Calm one type over. D210.

import { ECHOING_RUIN } from '../../../data/fixtures/engineCards';
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
  ECHOING_RUIN,
  'Destroy target artifact and all other artifacts with the same name as that artifact.',
);

export const ECHOING_RUIN_SCRIPT: CardScript = {
  oracleId: ECHOING_RUIN.oracleId,
  name: ECHOING_RUIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const isTarget = id === target.id;
        if (!isTarget) {
          if (!ctx.derive(id).typeLine.types.includes('Artifact')) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        }
        if (ctx.derive(id).keywords.has('indestructible')) continue;
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
