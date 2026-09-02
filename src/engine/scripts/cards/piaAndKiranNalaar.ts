// `Pia and Kiran Nalaar` — "When Pia and Kiran Nalaar enters, create two 1/1
// colorless Thopter artifact creature tokens with flying.\n{2}{R}, Sacrifice
// an artifact: Pia and Kiran Nalaar deals 2 damage to any target." Two of
// the pool's colourless Thopters on entry, and an ARTIFACT-type sacrifice
// chooser (Arenson's Aura's enchantment, D272, one type over — the Thopters
// themselves qualify) paying for a ping sourced from the Nalaars. D279.

import { PIA_AND_KIRAN_NALAAR } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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

const PRINTED = printed(
  PIA_AND_KIRAN_NALAAR,
  'When Pia and Kiran Nalaar enters, create two 1/1 colorless Thopter artifact creature tokens with flying.\n{2}{R}, Sacrifice an artifact: Pia and Kiran Nalaar deals 2 damage to any target.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const PING = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const THOPTER = tokenRef('Thopter|1/1||Artifact Creature|flying');

function thopter(ctx: ScriptCtx, controller: string): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: THOPTER.oracleId,
    printingId: THOPTER.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const PIA_AND_KIRAN_NALAAR_SCRIPT: CardScript = {
  oracleId: PIA_AND_KIRAN_NALAAR.oracleId,
  name: PIA_AND_KIRAN_NALAAR.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Pia and Kiran Nalaar — create two 1/1 Thopters',
      resolve: (ctx, _self, obj): readonly EventBody[] => [thopter(ctx, obj.controller), thopter(ctx, obj.controller)],
    },
  ],
  activated: [
    {
      ref: `${PIA_AND_KIRAN_NALAAR.oracleId}#a0`,
      text: PING,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        if (target.kind === 'player') {
          const them = ctx.state.players[target.id];
          if (!them || them.hasLost) return [];
        }
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 2,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
