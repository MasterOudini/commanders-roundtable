// `Lossarnach Captain` — "First strike\nWhenever this creature or another
// Human you control enters, tap target creature an opponent controls.\nAt
// the beginning of your upkeep, create a 1/1 white Human Soldier creature
// token." Théoden's self-or-HUMAN entry pair (D259: a card def and a token
// def, because the upkeep's own Human Soldier is a Human entering) aimed by
// Chupacabra's opponent spec (D237) at a creature to TAP, and Nyx-Fleece
// Ram's upkeep watcher making the pool's Human Soldier. The keyword line is
// the engine's. D277.

import { LOSSARNACH_CAPTAIN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { StackObject } from '../../types/state';

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

const PRINTED = printed(
  LOSSARNACH_CAPTAIN,
  'First strike\nWhenever this creature or another Human you control enters, tap target creature an opponent controls.\nAt the beginning of your upkeep, create a 1/1 white Human Soldier creature token.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const UPKEEP = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN_SOLDIER = tokenRef('Human Soldier|1/1|W|Creature|');

/** Itself, or another Human I control — asked of the DERIVED entrant. */
function selfOrMyHuman(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return true;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Human');
}

function tapTarget(ctx: ScriptCtx, obj: StackObject): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id];
  if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
  return [{ t: 'PermanentsTapped', cards: [target.id] }];
}

export const LOSSARNACH_CAPTAIN_SCRIPT: CardScript = {
  oracleId: LOSSARNACH_CAPTAIN.oracleId,
  name: LOSSARNACH_CAPTAIN.name,
  triggers: [
    {
      abilityId: 'enters-card',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && selfOrMyHuman(ctx, self, m.card),
        ),
      label: () => 'Lossarnach Captain — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => tapTarget(ctx, obj),
    },
    {
      abilityId: 'enters-token',
      text: ENTERS,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && selfOrMyHuman(ctx, self, ev.card),
      label: () => 'Lossarnach Captain — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => tapTarget(ctx, obj),
    },
    {
      abilityId: 'upkeep-soldier',
      text: UPKEEP,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Lossarnach Captain — create a 1/1 Human Soldier',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: HUMAN_SOLDIER.oracleId,
          printingId: HUMAN_SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
