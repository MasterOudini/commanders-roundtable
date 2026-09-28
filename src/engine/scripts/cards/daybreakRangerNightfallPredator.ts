// `Daybreak Ranger // Nightfall Predator` - an activation vocab, a eachUpkeep trigger vocab, an activation vocab, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAYBREAK_RANGER_NIGHTFALL_PREDATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAYBREAK_RANGER_NIGHTFALL_PREDATOR, "{T}: This creature deals 2 damage to target creature with flying.\nAt the beginning of each upkeep, if no spells were cast last turn, transform this creature.\n{R}, {T}: This creature fights target creature. (Each deals damage equal to its power to the other.)\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to target creature with flying.", DAYBREAK_RANGER_NIGHTFALL_PREDATOR.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to target creature with flying.");
const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", DAYBREAK_RANGER_NIGHTFALL_PREDATOR.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");
const VOCAB_A0b = vocabularyEffects("~ fights target creature.", DAYBREAK_RANGER_NIGHTFALL_PREDATOR.name);
const VOCAB_T_A0b = vocabularyTargets("~ fights target creature.");
const VOCAB_L3 = transformFrom(vocabularyEffects("Transform this creature.", DAYBREAK_RANGER_NIGHTFALL_PREDATOR.name), 1);
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


export const DAYBREAK_RANGER_NIGHTFALL_PREDATOR_SCRIPT: CardScript = {
  oracleId: DAYBREAK_RANGER_NIGHTFALL_PREDATOR.oracleId,
  name: DAYBREAK_RANGER_NIGHTFALL_PREDATOR.name,
  activated: [
    {
      ref: `${DAYBREAK_RANGER_NIGHTFALL_PREDATOR.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${DAYBREAK_RANGER_NIGHTFALL_PREDATOR.oracleId}#a0`, face: 1,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0b, VOCAB_T_A0b);
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
      label: () => "Daybreak Ranger // Nightfall Predator - Transform this creature.",
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
      label: () => "Daybreak Ranger // Nightfall Predator - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
