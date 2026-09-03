// `Coordinated Clobbering` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { COORDINATED_CLOBBERING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(COORDINATED_CLOBBERING, "Tap one or two target untapped creatures you control. They each deal damage equal to their power to target creature an opponent controls.");

export const COORDINATED_CLOBBERING_SCRIPT: CardScript = {
  oracleId: COORDINATED_CLOBBERING.oracleId,
  name: COORDINATED_CLOBBERING.name,
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
        { const taps: InstanceId[] = [];
          { const p = perm(0); if (p && !p.card.tapped) taps.push(p.id); }
          { const p = perm(1); if (p && !p.card.tapped) taps.push(p.id); }
          if (taps.length > 0) events.push({ t: 'PermanentsTapped', cards: taps }); }
        { const victim = perm(2); if (victim) {
          const damages = [];
          { const s = perm(0); if (s) { const pw = ctx.derive(s.id).power ?? 0; if (pw > 0) damages.push({ source: s.id, target: { kind: 'card' as const, id: victim.id }, amount: pw, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }); } }
          { const s = perm(1); if (s) { const pw = ctx.derive(s.id).power ?? 0; if (pw > 0) damages.push({ source: s.id, target: { kind: 'card' as const, id: victim.id }, amount: pw, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }); } }
          if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
        } }
      return events;
    },
  },
};
