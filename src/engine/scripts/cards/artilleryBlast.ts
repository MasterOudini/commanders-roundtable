// `Artillery Blast` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { ARTILLERY_BLAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARTILLERY_BLAST, "Domain — Artillery Blast deals X damage to target tapped creature, where X is 1 plus the number of basic land types among lands you control.");

export const ARTILLERY_BLAST_SCRIPT: CardScript = {
  oracleId: ARTILLERY_BLAST.oracleId,
  name: ARTILLERY_BLAST.name,
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
        { const p = perm(0); if (p) {
          const basics = new Set<string>();
          for (const c of Object.values(ctx.state.cards)) {
            if (c.zone.kind !== 'battlefield' || c.controller !== obj.controller) continue;
            const tl = ctx.derive(c.id).typeLine;
            if (!tl.types.includes('Land')) continue;
            for (const s of tl.subtypes) if (['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(s)) basics.add(s);
          }
          events.push({ t: 'DamageDealt', damages: [{ source: self, target: { kind: 'card', id: p.id }, amount: 1 + basics.size, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }] });
        } }
      return events;
    },
  },
};
