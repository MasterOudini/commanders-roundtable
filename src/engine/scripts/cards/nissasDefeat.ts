// `Nissa's Defeat` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { NISSA_S_DEFEAT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { CardInstance } from '../../types/state';

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

const TEXT = printed(NISSA_S_DEFEAT, "Destroy target Forest, green enchantment, or green planeswalker. If that permanent was a Nissa planeswalker, draw a card.");

export const NISSAS_DEFEAT_SCRIPT: CardScript = {
  oracleId: NISSA_S_DEFEAT.oracleId,
  name: NISSA_S_DEFEAT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const perm = (i: number): { id: InstanceId; card: CardInstance } | null => {
        const t = obj.targets[i];
        if (!t || t.kind !== 'card') return null;
        const card = ctx.state.cards[t.id];
        return card && card.zone.kind === 'battlefield' ? { id: t.id, card } : null;
      };
        { const p = perm(0); if (p && ctx.derive(p.id).typeLine.subtypes.includes("Nissa")) events.push(...drawEvents(ctx.state, obj.controller, 1)); }
        { const p = perm(0); if (p && !ctx.derive(p.id).keywords.has('indestructible')) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'graveyard', player: p.card.owner } }] }); }
      return events;
    },
  },
};
