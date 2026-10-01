// `Grazilaxx, Illithid Scholar` - a creatureYouControlBecomesBlocked trigger vocab, a creatureCombatDamagePlayer trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAZILAXX_ILLITHID_SCHOLAR } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(GRAZILAXX_ILLITHID_SCHOLAR, "Whenever a creature you control becomes blocked, you may return it to its owner's hand.\nWhenever one or more creatures you control deal combat damage to a player, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target creature to its owner's hand.", GRAZILAXX_ILLITHID_SCHOLAR.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature to its owner's hand.");

export const GRAZILAXX_ILLITHID_SCHOLAR_SCRIPT: CardScript = {
  oracleId: GRAZILAXX_ILLITHID_SCHOLAR.oracleId,
  name: GRAZILAXX_ILLITHID_SCHOLAR.name,
  triggers: [
    {
      abilityId: 'creatureYouControlBecomesBlocked-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      perItem: (ctx, self, ev) => (ev.t === 'BlockersDeclared' ? [...new Set(ev.blocks.filter((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)).map((b) => b.attacker))] : []),
      matches: (ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)),
      label: () => "Grazilaxx, Illithid Scholar - Return target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature')),
      label: () => "Grazilaxx, Illithid Scholar - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
