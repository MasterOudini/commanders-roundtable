// `Backlash` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { BACKLASH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BACKLASH, "Tap target untapped creature. That creature deals damage equal to its power to its controller.");

export const BACKLASH_SCRIPT: CardScript = {
  oracleId: BACKLASH.oracleId,
  name: BACKLASH.name,
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
        { const p = perm(0); if (p && !p.card.tapped) events.push({ t: 'PermanentsTapped', cards: [p.id] }); }
        { const p = perm(0); if (p) { const pw = ctx.derive(p.id).power ?? 0; if (pw > 0) events.push({ t: 'DamageDealt', damages: [{ source: p.id, target: { kind: 'player', id: p.card.controller }, amount: pw, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }] }); } }
      return events;
    },
  },
};
