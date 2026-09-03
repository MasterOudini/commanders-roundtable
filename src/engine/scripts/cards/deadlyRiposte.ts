// `Deadly Riposte` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { DEADLY_RIPOSTE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEADLY_RIPOSTE, "Deadly Riposte deals 3 damage to target tapped creature and you gain 2 life.");

export const DEADLY_RIPOSTE_SCRIPT: CardScript = {
  oracleId: DEADLY_RIPOSTE.oracleId,
  name: DEADLY_RIPOSTE.name,
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
        { const p = perm(0); if (p) events.push({ t: 'DamageDealt', damages: [{ source: self, target: { kind: 'card', id: p.id }, amount: 3, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }] }); }
        { const me = ctx.state.players[obj.controller]; if (me) events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + (2) }); }
      return events;
    },
  },
};
