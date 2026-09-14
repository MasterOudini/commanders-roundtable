// `Loyal Guardian` - a combatOnYourTurn trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOYAL_GUARDIAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(LOYAL_GUARDIAN, "Trample\nLieutenant — At the beginning of combat on your turn, if you control your commander, put a +1/+1 counter on each creature you control.");
const LINES = PRINTED.split('\n');

// "as long as you control your commander" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.commanderIds ?? []).some((id) => ctx.state.cards[id]?.zone.kind === 'battlefield' && ctx.state.cards[id]?.controller === me);
}


export const LOYAL_GUARDIAN_SCRIPT: CardScript = {
  oracleId: LOYAL_GUARDIAN.oracleId,
  name: LOYAL_GUARDIAN.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Loyal Guardian - a counter on each creature",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
