// `Thorn Thallid` - a upkeep trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORN_THALLID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORN_THALLID, "At the beginning of your upkeep, put a spore counter on this creature.\nRemove three spore counters from this creature: It deals 1 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("It deals 1 damage to any target.", THORN_THALLID.name);
const VOCAB_T_A0 = vocabularyTargets("It deals 1 damage to any target.");

export const THORN_THALLID_SCRIPT: CardScript = {
  oracleId: THORN_THALLID.oracleId,
  name: THORN_THALLID.name,
  activated: [
    {
      ref: `${THORN_THALLID.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Thorn Thallid - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "spore", delta: 1 }] }];
      },
    },
  ],
};
