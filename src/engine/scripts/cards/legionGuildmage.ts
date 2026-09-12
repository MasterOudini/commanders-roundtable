// `Legion Guildmage` - an activation damageOpponents, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEGION_GUILDMAGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody, ResolvedDamage } from '../../types/events';

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

const PRINTED = printed(LEGION_GUILDMAGE, "{5}{R}, {T}: This creature deals 3 damage to each opponent.\n{2}{W}, {T}: Tap another target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Tap another target creature.", LEGION_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Tap another target creature.");

export const LEGION_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: LEGION_GUILDMAGE.oracleId,
  name: LEGION_GUILDMAGE.name,
  activated: [
    {
      ref: `${LEGION_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        const damages: ResolvedDamage[] = [];
        for (const pid of Object.keys(ctx.state.players)) {
          if (pid === obj.controller) continue;
          damages.push({ source: self, target: { kind: 'player' as const, id: pid }, amount: 3, deathtouch: d.keywords.has('deathtouch'), lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null, isCommanderDamage: false, viaTrample: 0, toxic: d.toxicAmount ?? 0, applyAs: infect ? ('poison' as const) : wither ? ('wither' as const) : ('normal' as const) });
        }
        return damages.length ? [{ t: 'DamageDealt', damages }] : [];
      },
    },
    {
      ref: `${LEGION_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
