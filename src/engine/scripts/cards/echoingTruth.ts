// `Echoing Truth` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { ECHOING_TRUTH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ECHOING_TRUTH, "Return target nonland permanent and all other permanents with the same name as that permanent to their owners' hands.");

export const ECHOING_TRUTH_SCRIPT: CardScript = {
  oracleId: ECHOING_TRUTH.oracleId,
  name: ECHOING_TRUTH.name,
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
        { const p = perm(0); if (p) {
          for (const c of [p.card, ...sameName(p)]) {
            events.push({ t: 'CardsMoved', moves: [{ card: c.id, from: { kind: 'battlefield', player: c.controller }, to: { kind: 'hand', player: c.owner } }] });
          }
        } }
      return events;
    },
  },
};
