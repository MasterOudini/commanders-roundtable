// `Oblation` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { OBLATION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(OBLATION, "The owner of target nonland permanent shuffles it into their library, then draws two cards.");

export const OBLATION_SCRIPT: CardScript = {
  oracleId: OBLATION.oracleId,
  name: OBLATION.name,
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
        { const p = perm(0); if (p) {
          events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'library', player: p.card.owner }, placement: 'top' }] });
          const order = ctx.random.shuffled([...(ctx.state.zones.library[p.card.owner] ?? []), p.id]);
          events.push({ t: 'LibraryShuffled', player: p.card.owner, order });
        } }
        { const p = perm(0); if (p) events.push(...drawEvents(ctx.state, p.card.owner, 2)); }
      return events;
    },
  },
};
