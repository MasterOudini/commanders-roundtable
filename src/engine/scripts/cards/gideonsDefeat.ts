// `Gideon's Defeat` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { GIDEON_S_DEFEAT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GIDEON_S_DEFEAT, "Exile target white creature that's attacking or blocking. If it was a Gideon planeswalker, you gain 5 life.");

export const GIDEONS_DEFEAT_SCRIPT: CardScript = {
  oracleId: GIDEON_S_DEFEAT.oracleId,
  name: GIDEON_S_DEFEAT.name,
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
        { const p = perm(0); const me = ctx.state.players[obj.controller]; if (p && me && ctx.derive(p.id).typeLine.subtypes.includes('Gideon')) events.push({ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }); }
        { const p = perm(0); if (p) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'exile', player: p.card.owner } }] }); }
      return events;
    },
  },
};
