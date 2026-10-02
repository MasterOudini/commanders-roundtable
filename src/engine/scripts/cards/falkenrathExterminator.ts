// `Falkenrath Exterminator` - a combatDamagePlayer trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FALKENRATH_EXTERMINATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FALKENRATH_EXTERMINATOR, "Whenever this creature deals combat damage to a player, put a +1/+1 counter on it.\n{2}{R}: This creature deals damage to target creature equal to the number of +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage to target creature equal to the number of +1/+1 counters on ~.", FALKENRATH_EXTERMINATOR.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage to target creature equal to the number of +1/+1 counters on ~.");

export const FALKENRATH_EXTERMINATOR_SCRIPT: CardScript = {
  oracleId: FALKENRATH_EXTERMINATOR.oracleId,
  name: FALKENRATH_EXTERMINATOR.name,
  activated: [
    {
      ref: `${FALKENRATH_EXTERMINATOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Falkenrath Exterminator - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
