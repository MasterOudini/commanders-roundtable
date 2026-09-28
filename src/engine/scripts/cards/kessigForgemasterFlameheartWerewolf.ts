// `Kessig Forgemaster // Flameheart Werewolf` - a blocksOrBecomesBlocked trigger vocab, a eachUpkeep trigger vocab, a blocksOrBecomesBlocked trigger vocab, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF, "Whenever this creature blocks or becomes blocked by a creature, this creature deals 1 damage to that creature.\nAt the beginning of each upkeep, if no spells were cast last turn, transform this creature.\nWhenever this creature blocks or becomes blocked by a creature, this creature deals 2 damage to that creature.\nAt the beginning of each upkeep, if a player cast two or more spells last turn, transform this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to target creature.", KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to target creature.");
const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");
const VOCAB_L2 = vocabularyEffects("~ deals 2 damage to target creature.", KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF.name);
const VOCAB_T_L2 = vocabularyTargets("~ deals 2 damage to target creature.");
const VOCAB_L3 = transformFrom(vocabularyEffects("Transform this creature.", KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF.name), 1);
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


export const KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF_SCRIPT: CardScript = {
  oracleId: KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF.oracleId,
  name: KESSIG_FORGEMASTER_FLAMEHEART_WEREWOLF.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlocked-0', face: 0,
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self || b.attacker === self).map((b) => (b.blocker === self ? b.attacker : b.blocker)) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Kessig Forgemaster // Flameheart Werewolf - ~ deals 1 damage to target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'eachUpkeep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep'),
      label: () => "Kessig Forgemaster // Flameheart Werewolf - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'blocksOrBecomesBlocked-2', face: 1,
      text: LINES[2] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self || b.attacker === self).map((b) => (b.blocker === self ? b.attacker : b.blocker)) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Kessig Forgemaster // Flameheart Werewolf - ~ deals 2 damage to target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L2, VOCAB_T_L2);
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
      label: () => "Kessig Forgemaster // Flameheart Werewolf - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
