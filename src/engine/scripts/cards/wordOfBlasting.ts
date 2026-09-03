// `Word of Blasting` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { WORD_OF_BLASTING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WORD_OF_BLASTING, "Destroy target Wall. It can't be regenerated. Word of Blasting deals damage equal to that Wall's mana value to the Wall's controller.");

export const WORD_OF_BLASTING_SCRIPT: CardScript = {
  oracleId: WORD_OF_BLASTING.oracleId,
  name: WORD_OF_BLASTING.name,
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
        { const p = perm(0); if (p) { const mv = ctx.derive(p.id).manaValue ?? 0; if (mv > 0) events.push({ t: 'DamageDealt', damages: [{ source: self, target: { kind: 'player', id: p.card.controller }, amount: mv, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' as const }] }); } }
        { const p = perm(0); if (p && !ctx.derive(p.id).keywords.has('indestructible')) events.push({ t: 'CardsMoved', moves: [{ card: p.id, from: { kind: 'battlefield', player: p.card.controller }, to: { kind: 'graveyard', player: p.card.owner } }] }); }
      return events;
    },
  },
};
