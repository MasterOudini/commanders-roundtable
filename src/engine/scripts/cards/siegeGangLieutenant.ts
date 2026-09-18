// `Siege-Gang Lieutenant` - a combatOnYourTurn trigger vocab, an activation damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIEGE_GANG_LIEUTENANT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SIEGE_GANG_LIEUTENANT, "Lieutenant — At the beginning of combat on your turn, if you control your commander, create two 1/1 red Goblin creature tokens. Those tokens gain haste until end of turn.\n{2}, Sacrifice a Goblin: This creature deals 1 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create two 1/1 red Goblin creature tokens. Those tokens gain haste until end of turn.", SIEGE_GANG_LIEUTENANT.name);
const VOCAB_T_L0 = vocabularyTargets("Create two 1/1 red Goblin creature tokens. Those tokens gain haste until end of turn.");

// "as long as you control your commander" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.commanderIds ?? []).some((id) => ctx.state.cards[id]?.zone.kind === 'battlefield' && ctx.state.cards[id]?.controller === me);
}


export const SIEGE_GANG_LIEUTENANT_SCRIPT: CardScript = {
  oracleId: SIEGE_GANG_LIEUTENANT.oracleId,
  name: SIEGE_GANG_LIEUTENANT.name,
  activated: [
    {
      ref: `${SIEGE_GANG_LIEUTENANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 1,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount ?? 0,
                applyAs: target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Siege-Gang Lieutenant - Create two 1/1 red Goblin creature tokens. Those tokens gain haste until end of turn.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
