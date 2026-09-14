// `Super-Skrull` - an activation token, an activation pumping itself, an activation damageTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUPER_SKRULL } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(SUPER_SKRULL, "Flying\n{2}{W}: Create a 0/4 colorless Wall creature token with defender.\n{3}{G}: Super-Skrull gets +4/+4 until end of turn.\n{4}{R}: Super-Skrull deals 4 damage to target creature.\n{5}{U}: Target player draws four cards.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Wall|0/4||Creature|defender");

const VOCAB_A3 = vocabularyEffects("Target player draws four cards.", SUPER_SKRULL.name);
const VOCAB_T_A3 = vocabularyTargets("Target player draws four cards.");

export const SUPER_SKRULL_SCRIPT: CardScript = {
  oracleId: SUPER_SKRULL.oracleId,
  name: SUPER_SKRULL.name,
  activated: [
    {
      ref: `${SUPER_SKRULL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
    {
      ref: `${SUPER_SKRULL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 4, toughness: 4 }];
      },
    },
    {
      ref: `${SUPER_SKRULL.oracleId}#a2`,
      text: LINES[3] as string,
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
                amount: 4,
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
      ref: `${SUPER_SKRULL.oracleId}#a3`,
      text: LINES[4] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A3, VOCAB_T_A3);
      },
    },
  ],
};
