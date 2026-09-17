// `Alpine Guide` - a etb trigger vocab, a static mustAttack, a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALPINE_GUIDE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(ALPINE_GUIDE, "When this creature enters, you may search your library for a Mountain card, put that card onto the battlefield tapped, then shuffle.\nThis creature attacks each combat if able.\nWhen this creature leaves the battlefield, sacrifice a Mountain.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a Mountain card, put that card onto the battlefield tapped, then shuffle.", ALPINE_GUIDE.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a Mountain card, put that card onto the battlefield tapped, then shuffle.");
const VOCAB_L2 = vocabularyEffects("Sacrifice a Mountain.", ALPINE_GUIDE.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice a Mountain.");

export const ALPINE_GUIDE_SCRIPT: CardScript = {
  oracleId: ALPINE_GUIDE.oracleId,
  name: ALPINE_GUIDE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Alpine Guide - Search your library for a Mountain card, put that card onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'leavesBattlefield-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Alpine Guide - Sacrifice a Mountain.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
