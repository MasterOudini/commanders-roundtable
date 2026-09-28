// `Smoldering Werewolf // Erupting Dreadwolf` - a etb trigger vocab, an activation vocab, a attacks trigger damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF, "When this creature enters, it deals 1 damage to each of up to two target creatures.\n{4}{R}{R}: Transform this creature.\nWhenever this creature attacks, it deals 2 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to each of up to two target creatures.", SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to each of up to two target creatures.");
const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF_SCRIPT: CardScript = {
  oracleId: SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF.oracleId,
  name: SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF.name,
  activated: [
    {
      ref: `${SMOLDERING_WEREWOLF_ERUPTING_DREADWOLF.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Smoldering Werewolf // Erupting Dreadwolf - ~ deals 1 damage to each of up to two target creatures.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-2', face: 1,
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(LINES[2] as string),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Smoldering Werewolf // Erupting Dreadwolf - damageTarget",
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
                amount: 2,
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
  ],
};
