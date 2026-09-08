// `Breya, Etherium Shaper` - a etb trigger token, an activation damageTarget, an activation pumpTarget, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BREYA_ETHERIUM_SHAPER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(BREYA_ETHERIUM_SHAPER, "When Breya enters, create two 1/1 blue Thopter artifact creature tokens with flying.\n{2}, Sacrifice two artifacts: Choose one —\n• Breya deals 3 damage to target player or planeswalker.\n• Target creature gets -4/-4 until end of turn.\n• You gain 5 life.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Thopter|1/1|U|Artifact Creature|flying");

const MODES_A0 = [
  { text: "Breya deals 3 damage to target player or planeswalker.", targets: vocabularyTargets("~ deals 3 damage to target player or planeswalker.") },
  { text: "Target creature gets -4/-4 until end of turn.", targets: vocabularyTargets("Target creature gets -4/-4 until end of turn.") },
  { text: "You gain 5 life.", targets: vocabularyTargets("You gain 5 life.") },
];

export const BREYA_ETHERIUM_SHAPER_SCRIPT: CardScript = {
  oracleId: BREYA_ETHERIUM_SHAPER.oracleId,
  name: BREYA_ETHERIUM_SHAPER.name,
  activated: [
    {
      ref: `${BREYA_ETHERIUM_SHAPER.oracleId}#a0`,
      text: LINES[1] as string,
      modes: MODES_A0,
      modeChoice: { min: 1, max: 1 },
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D365 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
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
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind !== 'card') return [];
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -4, toughness: -4 }];
        }
        if (chosen === 2) {
          const me = ctx.state.players[obj.controller];
          if (!me) return [];
          return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }];
        }
        return [];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Breya, Etherium Shaper - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
