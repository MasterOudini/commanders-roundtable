// `Dragonsguard Elite` - a castInstantSorcery trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGONSGUARD_ELITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAGONSGUARD_ELITE, "Magecraft — Whenever you cast or copy an instant or sorcery spell, put a +1/+1 counter on this creature.\n{4}{G}{G}: Double the number of +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Double the number of +1/+1 counters on ~.", DRAGONSGUARD_ELITE.name);
const VOCAB_T_A0 = vocabularyTargets("Double the number of +1/+1 counters on ~.");

export const DRAGONSGUARD_ELITE_SCRIPT: CardScript = {
  oracleId: DRAGONSGUARD_ELITE.oracleId,
  name: DRAGONSGUARD_ELITE.name,
  activated: [
    {
      ref: `${DRAGONSGUARD_ELITE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Dragonsguard Elite - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
