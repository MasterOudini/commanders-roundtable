// `Billowing Shriekmass` - a etb trigger mill, a static threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BILLOWING_SHRIEKMASS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BILLOWING_SHRIEKMASS, "Flying\nWhen this creature enters, mill three cards. (Put the top three cards of your library into your graveyard.)\nThreshold — This creature gets +2/+1 as long as there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const BILLOWING_SHRIEKMASS_SCRIPT: CardScript = {
  oracleId: BILLOWING_SHRIEKMASS.oracleId,
  name: BILLOWING_SHRIEKMASS.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Billowing Shriekmass - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 3));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
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
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
