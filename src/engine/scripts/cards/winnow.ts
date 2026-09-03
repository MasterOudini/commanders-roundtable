// `Winnow` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { WINNOW } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WINNOW, "Destroy target nonland permanent if another permanent with the same name is on the battlefield.\nDraw a card.");

export const WINNOW_SCRIPT: CardScript = {
  oracleId: WINNOW.oracleId,
  name: WINNOW.name,
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
      const sameName = (p: { id: InstanceId; card: CardInstance }): CardInstance[] =>
        Object.values(ctx.state.cards).filter((c) => c.id !== p.id && c.zone.kind === 'battlefield' && c.oracleId === p.card.oracleId);
        { const p = perm(0); if (p && sameName(p).length > 0 && !ctx.derive(p.id).keywords.has('indestructible')) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'graveyard', player: p.card.owner } }] }); }
        events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
