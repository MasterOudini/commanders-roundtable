// `Lord of the Undead` - the layer-6 anthem "Other Zombie creatures get +1/+1"
// (every controller's Zombies but itself; a StaticDef in the shape of the
// engine's Levitation, D300) and "{1}{B}, {T}: Return target Zombie card from
// your graveyard to your hand" (D298's subtype card noun; the engine charges the
// cost, the script moves the card).

import { LORD_OF_THE_UNDEAD } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(LORD_OF_THE_UNDEAD, 'Other Zombie creatures get +1/+1.\n{1}{B}, {T}: Return target Zombie card from your graveyard to your hand.');
const LINES = PRINTED.split('\n');

export const LORD_OF_THE_UNDEAD_SCRIPT: CardScript = {
  oracleId: LORD_OF_THE_UNDEAD.oracleId,
  name: LORD_OF_THE_UNDEAD.name,
  statics: [
    {
      abilityId: 'anthem',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes('Creature')) return false;
        return chars.typeLine.subtypes.includes('Zombie');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
  activated: [
    {
      ref: `${LORD_OF_THE_UNDEAD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
