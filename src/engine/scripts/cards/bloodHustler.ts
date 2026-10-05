// `Blood Hustler` - a youCommitCrime trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOOD_HUSTLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOOD_HUSTLER, "Whenever you commit a crime, put a +1/+1 counter on this creature. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)\n{3}{B}: Target opponent loses 1 life and you gain 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", BLOOD_HUSTLER.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const BLOOD_HUSTLER_SCRIPT: CardScript = {
  oracleId: BLOOD_HUSTLER.oracleId,
  name: BLOOD_HUSTLER.name,
  activated: [
    {
      ref: `${BLOOD_HUSTLER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youCommitCrime-0',
      text: LINES[0] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Blood Hustler - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
