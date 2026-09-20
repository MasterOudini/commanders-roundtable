// `Domri, City Smasher` - an activation pumping its controller's creatures, an activation damageTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOMRI_CITY_SMASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOMRI_CITY_SMASHER, "+2: Creatures you control get +1/+1 and gain haste until end of turn.\n−3: Domri deals 3 damage to any target.\n−8: Put three +1/+1 counters on each creature you control. Those creatures gain trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Put three +1/+1 counters on each creature you control. Those creatures gain trample until end of turn.", DOMRI_CITY_SMASHER.name);
const VOCAB_T_A2 = vocabularyTargets("Put three +1/+1 counters on each creature you control. Those creatures gain trample until end of turn.");

export const DOMRI_CITY_SMASHER_SCRIPT: CardScript = {
  oracleId: DOMRI_CITY_SMASHER.oracleId,
  name: DOMRI_CITY_SMASHER.name,
  activated: [
    {
      ref: `${DOMRI_CITY_SMASHER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["haste"] });
        }
        return out;
      },
    },
    {
      ref: `${DOMRI_CITY_SMASHER.oracleId}#a1`,
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
      ref: `${DOMRI_CITY_SMASHER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
