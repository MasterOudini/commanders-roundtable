// `Peggy Carter, Secret Agent` - a aCreatureAttacksAlone trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PEGGY_CARTER_SECRET_AGENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PEGGY_CARTER_SECRET_AGENT, "Whenever a creature you control attacks alone, it gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");

const VOCAB_L0 = vocabularyEffects("Target creature gains indestructible until end of turn.", PEGGY_CARTER_SECRET_AGENT.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gains indestructible until end of turn.");

export const PEGGY_CARTER_SECRET_AGENT_SCRIPT: CardScript = {
  oracleId: PEGGY_CARTER_SECRET_AGENT.oracleId,
  name: PEGGY_CARTER_SECRET_AGENT.name,
  triggers: [
    {
      abilityId: 'aCreatureAttacksAlone-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'AttackersDeclared' && ev.attackers.length === 1 ? ev.attackers.map((a) => a.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers.every((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Peggy Carter, Secret Agent - Target creature gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
