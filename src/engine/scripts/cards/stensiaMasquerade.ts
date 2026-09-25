// `Stensia Masquerade` - a static anthem, a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STENSIA_MASQUERADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STENSIA_MASQUERADE, "Attacking creatures you control have first strike.\nWhenever a Vampire you control deals combat damage to a player, put a +1/+1 counter on it.\nMadness {2}{R} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature.", STENSIA_MASQUERADE.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const STENSIA_MASQUERADE_SCRIPT: CardScript = {
  oracleId: STENSIA_MASQUERADE.oracleId,
  name: STENSIA_MASQUERADE.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.subtypes.includes('Vampire')).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.subtypes.includes('Vampire')),
      label: () => "Stensia Masquerade - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.combat?.attackers.some((x) => x.card === candidate) ?? false) && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
