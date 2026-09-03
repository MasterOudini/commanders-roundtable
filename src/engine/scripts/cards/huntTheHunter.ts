// `Hunt the Hunter` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { HUNT_THE_HUNTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HUNT_THE_HUNTER, "Target green creature you control gets +2/+2 until end of turn. It fights target green creature an opponent controls.");

export const HUNT_THE_HUNTER_SCRIPT: CardScript = {
  oracleId: HUNT_THE_HUNTER.oracleId,
  name: HUNT_THE_HUNTER.name,
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
        { const p = perm(0); if (p) events.push({ t: 'PtModifiedUntilEndOfTurn', card: p.id, power: 2, toughness: 2 }); }
        { const a = perm(0); const b = perm(1); if (a && b) {
          const da = ctx.derive(a.id); const db = ctx.derive(b.id);
          const pa = (da.power ?? 0) + 2;
          const pb = db.power ?? 0;
          const damages = [];
          if (pa > 0) damages.push({ source: a.id, target: { kind: 'card' as const, id: b.id }, amount: pa, deathtouch: da.keywords.has('deathtouch'), lifelinkTo: da.keywords.has('lifelink') ? obj.controller : null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const });
          if (pb > 0) damages.push({ source: b.id, target: { kind: 'card' as const, id: a.id }, amount: pb, deathtouch: db.keywords.has('deathtouch'), lifelinkTo: db.keywords.has('lifelink') ? b.card.controller : null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const });
          if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
        } }
      return events;
    },
  },
};
