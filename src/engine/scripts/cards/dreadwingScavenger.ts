// `Dreadwing Scavenger` - a etb trigger loot, a attacks trigger loot, a static threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREADWING_SCAVENGER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(DREADWING_SCAVENGER, "Flying\nWhenever this creature enters or attacks, draw a card, then discard a card.\nThreshold — This creature gets +1/+1 and has deathtouch as long as there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const DREADWING_SCAVENGER_SCRIPT: CardScript = {
  oracleId: DREADWING_SCAVENGER.oracleId,
  name: DREADWING_SCAVENGER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Dreadwing Scavenger - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Dreadwing Scavenger - discard a card" } },
        ];
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Dreadwing Scavenger - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Dreadwing Scavenger - discard a card" } },
        ];
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && thresholdOf(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'threshold-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && thresholdOf(ctx, self),
      modify: (chars) => {
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
