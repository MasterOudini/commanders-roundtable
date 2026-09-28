// `Duskwatch Recruiter // Krallenhorde Howler` - an activation vocab, a eachUpkeep trigger vocab, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER, "{2}{G}: Look at the top three cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in any order.\nAt the beginning of each upkeep, if no spells were cast last turn, transform this creature.\nCreature spells you cast cost {1} less to cast.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Look at the top three cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top three cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");
const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");
const VOCAB_L3 = transformFrom(vocabularyEffects("Transform this creature.", DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER.name), 1);
const VOCAB_T_L3 = vocabularyTargets("Transform this creature.");

// "as long as no spells were cast last turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return Object.values(ctx.state.turn.lastTurnSpells ?? {}).every((k) => k === 0);
}

// "as long as a player cast two or more spells last turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond3Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return Object.values(ctx.state.turn.lastTurnSpells ?? {}).some((k) => k >= 2);
}


export const DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER_SCRIPT: CardScript = {
  oracleId: DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER.oracleId,
  name: DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER.name,
  activated: [
    {
      ref: `${DUSKWATCH_RECRUITER_KRALLENHORDE_HOWLER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'eachUpkeep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Duskwatch Recruiter // Krallenhorde Howler - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'eachUpkeep-3', face: 1,
      text: LINES[3] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond3Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Duskwatch Recruiter // Krallenhorde Howler - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
