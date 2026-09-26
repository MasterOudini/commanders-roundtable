// `District Mascot` - a static entersWithCounters, an activation vocab, a attacksWhileSaddled trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISTRICT_MASCOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DISTRICT_MASCOT, "This creature enters with a +1/+1 counter on it.\n{1}{G}, Remove two +1/+1 counters from this creature: Destroy target artifact.\nWhenever this creature attacks while saddled, put a +1/+1 counter on it.\nSaddle 1");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact.", DISTRICT_MASCOT.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact.");

export const DISTRICT_MASCOT_SCRIPT: CardScript = {
  oracleId: DISTRICT_MASCOT.oracleId,
  name: DISTRICT_MASCOT.name,
  activated: [
    {
      ref: `${DISTRICT_MASCOT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "District Mascot - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }],
    },
  ],
};
