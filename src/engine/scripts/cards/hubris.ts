// `Hubris` — the target goes home and every AURA riding it goes with it
// (End Hostilities' attachedTo scan, bounced instead of binned). D218.

import { HUBRIS } from '../../../data/fixtures/engineCards';
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
  HUBRIS,
  "Return target creature and all Auras attached to it to their owners' hands.",
);

export const HUBRIS_SCRIPT: CardScript = {
  oracleId: HUBRIS.oracleId,
  name: HUBRIS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const moves = [];
      moves.push({
        card: target.id,
        from: { kind: 'battlefield' as const, player: victim.controller },
        to: { kind: 'hand' as const, player: victim.owner },
      });
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.attachedTo !== target.id) continue;
        if (!ctx.derive(id).typeLine.subtypes.includes('Aura')) continue;
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
