// `Legions to Ashes` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { LEGIONS_TO_ASHES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LEGIONS_TO_ASHES, "Exile target nonland permanent an opponent controls and all tokens that player controls with the same name as that permanent.");

export const LEGIONS_TO_ASHES_SCRIPT: CardScript = {
  oracleId: LEGIONS_TO_ASHES.oracleId,
  name: LEGIONS_TO_ASHES.name,
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
        { const p = perm(0); if (p) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'exile', player: p.card.owner } }] }); }
        { const p = perm(0); if (p) {
          for (const c of sameName(p)) {
            if (!c.isToken || c.controller !== p.card.controller) continue;
            events.push({ t: 'CardsMoved', moves: [{ card: c.id, from: { kind: 'battlefield', player: c.controller }, to: { kind: 'exile', player: c.owner } }] });
          }
        } }
      return events;
    },
  },
};
