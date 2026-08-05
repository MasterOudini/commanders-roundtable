// `Briarknit Kami` — "Whenever you cast a Spirit or Arcane spell, put a
// +1/+1 counter on target creature." The first SUBTYPE-filtered cast-watcher
// (Talrand asks card TYPES; this asks the face's subtypes), targeting through
// D147's machinery. M6.4h, D165.

import { BRIARKNIT_KAMI } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  BRIARKNIT_KAMI,
  'Whenever you cast a Spirit or Arcane spell, put a +1/+1 counter on target creature.',
);

export const BRIARKNIT_KAMI_SCRIPT: CardScript = {
  oracleId: BRIARKNIT_KAMI.oracleId,
  name: BRIARKNIT_KAMI.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const subtypes = faceOf(oc, ev.obj.faceIndex).typeLine.subtypes;
        return subtypes.includes('Spirit') || subtypes.includes('Arcane');
      },
      label: () => 'Briarknit Kami — +1/+1 counter on target creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
