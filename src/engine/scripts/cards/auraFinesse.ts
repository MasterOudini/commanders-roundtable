// `Aura Finesse` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { AURA_FINESSE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(AURA_FINESSE, "Attach target Aura you control to target creature.\nDraw a card.");

export const AURA_FINESSE_SCRIPT: CardScript = {
  oracleId: AURA_FINESSE.oracleId,
  name: AURA_FINESSE.name,
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
        { const a = perm(0); const b = perm(1); if (a && b && a.id !== b.id) events.push({ t: 'AttachmentChanged', card: a.id, to: b.id }); }
        events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
