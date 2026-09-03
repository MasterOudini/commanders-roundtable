// `Infernal Reckoning` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { INFERNAL_RECKONING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(INFERNAL_RECKONING, "Exile target colorless creature. You gain life equal to its power.");

export const INFERNAL_RECKONING_SCRIPT: CardScript = {
  oracleId: INFERNAL_RECKONING.oracleId,
  name: INFERNAL_RECKONING.name,
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
        { const p = perm(0); const me = ctx.state.players[obj.controller]; if (p && me) { const n = (1) * (ctx.derive(p.id).power ?? 0); if (n !== 0) events.push({ t: 'LifeChanged', player: obj.controller, delta: n, to: me.life + n }); } }
        { const p = perm(0); if (p) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'exile', player: p.card.owner } }] }); }
      return events;
    },
  },
};
