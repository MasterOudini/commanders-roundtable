// `Constable of the Realm` - a renownDamage trigger renown, a countersPutOnSelf trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONSTABLE_OF_THE_REALM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONSTABLE_OF_THE_REALM, "Renown 2 (When this creature deals combat damage to a player, if it isn't renowned, put two +1/+1 counters on it and it becomes renowned.)\nWhenever one or more +1/+1 counters are put on this creature, exile up to one other target nonland permanent until this creature leaves the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile up to one other target nonland permanent until this creature leaves the battlefield.", CONSTABLE_OF_THE_REALM.name);
const VOCAB_T_L1 = vocabularyTargets("Exile up to one other target nonland permanent until this creature leaves the battlefield.");

export const CONSTABLE_OF_THE_REALM_SCRIPT: CardScript = {
  oracleId: CONSTABLE_OF_THE_REALM.oracleId,
  name: CONSTABLE_OF_THE_REALM.name,
  triggers: [
    {
      abilityId: 'renownDamage-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && !(ctx.state.cards[self]?.renowned ?? false) && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Constable of the Realm - renown",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Renown 2 (CR 702.112): checked again on resolution - once renowned, never again.
        if (ctx.state.cards[self]?.renowned) return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 2 }] }, { t: 'BecameRenowned', card: self }];
      },
    },
    {
      abilityId: 'countersPutOnSelf-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Constable of the Realm - Exile up to one other target nonland permanent until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
