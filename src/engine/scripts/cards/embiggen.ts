// `Embiggen` - a scripted spell: the target clause is the parser's and the validator's
// (D294's adjectives), the rider is this script's. Generated from one table row (D295).

import { EMBIGGEN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(EMBIGGEN, "Until end of turn, target non-Brushwagg creature gets +1/+1 for each supertype, card type, and subtype it has.");

export const EMBIGGEN_SCRIPT: CardScript = {
  oracleId: EMBIGGEN.oracleId,
  name: EMBIGGEN.name,
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
        { const p = perm(0); if (p) { const tl = ctx.derive(p.id).typeLine; const n = tl.supertypes.length + tl.types.length + tl.subtypes.length; if (n > 0) events.push({ t: 'PtModifiedUntilEndOfTurn', card: p.id, power: n, toughness: n }); } }
      return events;
    },
  },
};
