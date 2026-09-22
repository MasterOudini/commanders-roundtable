// `Consul's Shieldguard` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONSUL_S_SHIELDGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONSUL_S_SHIELDGUARD, "When this creature enters, you get {E}{E} (two energy counters).\nWhenever this creature attacks, you may pay {E}. If you do, another target attacking creature gains indestructible until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}.", CONSUL_S_SHIELDGUARD.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}.");
const VOCAB_L1 = vocabularyEffects("You may pay {E}. If you do, another target attacking creature gains indestructible until end of turn.", CONSUL_S_SHIELDGUARD.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {E}. If you do, another target attacking creature gains indestructible until end of turn.");

export const CONSULS_SHIELDGUARD_SCRIPT: CardScript = {
  oracleId: CONSUL_S_SHIELDGUARD.oracleId,
  name: CONSUL_S_SHIELDGUARD.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Consul's Shieldguard - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Consul's Shieldguard - You may pay {E}. If you do, another target attacking creature gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
