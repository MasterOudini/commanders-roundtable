// `Akroan Conscriptor` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AKROAN_CONSCRIPTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AKROAN_CONSCRIPTOR, "Heroic — Whenever you cast a spell that targets this creature, gain control of another target creature until end of turn. Untap that creature. It gains haste until end of turn.");

const VOCAB_L0 = vocabularyEffects("Gain control of another target creature until end of turn. Untap that creature. It gains haste until end of turn.", AKROAN_CONSCRIPTOR.name);
const VOCAB_T_L0 = vocabularyTargets("Gain control of another target creature until end of turn. Untap that creature. It gains haste until end of turn.");

export const AKROAN_CONSCRIPTOR_SCRIPT: CardScript = {
  oracleId: AKROAN_CONSCRIPTOR.oracleId,
  name: AKROAN_CONSCRIPTOR.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Akroan Conscriptor - Gain control of another target creature until end of turn. Untap that creature. It gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
