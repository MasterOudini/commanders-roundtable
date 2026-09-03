// `Unforge` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { UNFORGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(UNFORGE, "Destroy target Equipment. If that Equipment was attached to a creature, Unforge deals 2 damage to that creature.");

export const UNFORGE_SCRIPT: CardScript = {
  oracleId: UNFORGE.oracleId,
  name: UNFORGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const perm = (i: number): { id: InstanceId; card: CardInstance } | null => {
        const t = obj.targets[i];
        if (!t || t.kind !== 'card') return null;
        const card = ctx.state.cards[t.id];
        return card && card.zone.kind === 'battlefield' ? { id: t.id, card } : null;
      };
        { const p = perm(0); const host = p?.card.attachedTo ? ctx.state.cards[p.card.attachedTo] : undefined; if (p && host && host.zone.kind === 'battlefield' && ctx.derive(host.id).typeLine.types.includes('Creature')) events.push({ t: 'DamageDealt', damages: [{ source: self, target: { kind: 'card', id: host.id }, amount: 2, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }] }); }
        { const p = perm(0); if (p && !ctx.derive(p.id).keywords.has('indestructible')) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'graveyard', player: p.card.owner } }] }); }
      return events;
    },
  },
};
