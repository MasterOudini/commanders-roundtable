// `Zacama, Primal Calamity` - a etb trigger vocab, an activation damageTarget, an activation vocab, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZACAMA_PRIMAL_CALAMITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZACAMA_PRIMAL_CALAMITY, "Vigilance, reach, trample\nWhen Zacama enters, if you cast it, untap all lands you control.\n{2}{R}: Zacama deals 3 damage to target creature.\n{2}{G}: Destroy target artifact or enchantment.\n{2}{W}: You gain 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap all lands you control.", ZACAMA_PRIMAL_CALAMITY.name);
const VOCAB_T_L1 = vocabularyTargets("Untap all lands you control.");
const VOCAB_A1 = vocabularyEffects("Destroy target artifact or enchantment.", ZACAMA_PRIMAL_CALAMITY.name);
const VOCAB_T_A1 = vocabularyTargets("Destroy target artifact or enchantment.");

// "as long as you cast it" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.cards[self]?.castFromZone !== undefined;
}


export const ZACAMA_PRIMAL_CALAMITY_SCRIPT: CardScript = {
  oracleId: ZACAMA_PRIMAL_CALAMITY.oracleId,
  name: ZACAMA_PRIMAL_CALAMITY.name,
  activated: [
    {
      ref: `${ZACAMA_PRIMAL_CALAMITY.oracleId}#a0`,
      text: LINES[2] as string,
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
                amount: 3,
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
    {
      ref: `${ZACAMA_PRIMAL_CALAMITY.oracleId}#a1`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${ZACAMA_PRIMAL_CALAMITY.oracleId}#a2`,
      text: LINES[4] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Zacama, Primal Calamity - Untap all lands you control.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
