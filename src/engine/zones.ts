// Immutable zone-array surgery.
//
// ⚠️ ORDER CONVENTION: index 0 is the BOTTOM of a library and the BOTTOM of the
// stack; the last element is the top. One convention for both is worth the
// minute it takes to internalise, because the alternative is a `draw` that
// reads `[0]` and a `resolve` that reads `[length-1]` in the same file.

import type { InstanceId, ZoneRef } from './types/ids';
import type { GameState, Zones } from './types/state';

type PerPlayer = Readonly<Record<string, readonly InstanceId[]>>;

function withPlayerZone(map: PerPlayer, player: string, next: readonly InstanceId[]): PerPlayer {
  return { ...map, [player]: next };
}

export function zoneContents(zones: Zones, zone: ZoneRef): readonly InstanceId[] {
  switch (zone.kind) {
    case 'battlefield':
      return zones.battlefield;
    case 'library':
      return (zone.player ? zones.library[zone.player] : undefined) ?? [];
    case 'hand':
      return (zone.player ? zones.hand[zone.player] : undefined) ?? [];
    case 'graveyard':
      return (zone.player ? zones.graveyard[zone.player] : undefined) ?? [];
    case 'exile':
      return (zone.player ? zones.exile[zone.player] : undefined) ?? [];
    case 'command':
      return (zone.player ? zones.command[zone.player] : undefined) ?? [];
    case 'stack':
      // The stack's membership lives in `state.stack` as StackObjects, because
      // an ability on the stack is not a card and has no zone array entry.
      return [];
  }
}

function setZone(zones: Zones, zone: ZoneRef, next: readonly InstanceId[]): Zones {
  switch (zone.kind) {
    case 'battlefield':
      return { ...zones, battlefield: next };
    case 'library':
      return zone.player ? { ...zones, library: withPlayerZone(zones.library, zone.player, next) } : zones;
    case 'hand':
      return zone.player ? { ...zones, hand: withPlayerZone(zones.hand, zone.player, next) } : zones;
    case 'graveyard':
      return zone.player ? { ...zones, graveyard: withPlayerZone(zones.graveyard, zone.player, next) } : zones;
    case 'exile':
      return zone.player ? { ...zones, exile: withPlayerZone(zones.exile, zone.player, next) } : zones;
    case 'command':
      return zone.player ? { ...zones, command: withPlayerZone(zones.command, zone.player, next) } : zones;
    case 'stack':
      return zones;
  }
}

export function removeFromZone(zones: Zones, zone: ZoneRef, id: InstanceId): Zones {
  const list = zoneContents(zones, zone);
  const at = list.indexOf(id);
  if (at < 0) return zones;
  const next = [...list.slice(0, at), ...list.slice(at + 1)];
  return setZone(zones, zone, next);
}

export function addToZone(
  zones: Zones,
  zone: ZoneRef,
  id: InstanceId,
  placement: 'top' | 'bottom' = 'top',
): Zones {
  const list = zoneContents(zones, zone);
  if (list.includes(id)) return zones;
  // Only a library has a meaningful bottom; everywhere else "top" just means
  // "append", which is the arrival order the table renders.
  const next = placement === 'bottom' && zone.kind === 'library' ? [id, ...list] : [...list, id];
  return setZone(zones, zone, next);
}

/** Every zone a card could be in, for invariant checks. */
export function findZoneOf(state: GameState, id: InstanceId): ZoneRef | null {
  if (state.zones.battlefield.includes(id)) return { kind: 'battlefield', player: null };
  for (const p of state.seating) {
    if ((state.zones.library[p] ?? []).includes(id)) return { kind: 'library', player: p };
    if ((state.zones.hand[p] ?? []).includes(id)) return { kind: 'hand', player: p };
    if ((state.zones.graveyard[p] ?? []).includes(id)) return { kind: 'graveyard', player: p };
    if ((state.zones.exile[p] ?? []).includes(id)) return { kind: 'exile', player: p };
    if ((state.zones.command[p] ?? []).includes(id)) return { kind: 'command', player: p };
  }
  if (state.stack.some((s) => s.card === id)) return { kind: 'stack', player: null };
  return null;
}

/**
 * D573 - THE BATTLEFIELD IN PLAY: every permanent less the phased-out ones (CR 702.26b - treated as though they do not
 * exist). The same array when nothing is phased out, so the common walk allocates nothing. The raw list stays for the
 * zone's bookkeeping, the view and the phasing turn action itself.
 */
export function inPlay(state: Pick<GameState, 'zones' | 'cards'>): readonly InstanceId[] {
  const bf = state.zones.battlefield;
  return bf.some((id) => state.cards[id]?.phasedOut === true) ? bf.filter((id) => state.cards[id]?.phasedOut !== true) : bf;
}

/**
 * D573 - the PhasedOut event for these permanents: each one still phased in, and every permanent attached to one of
 * them phases out INDIRECTLY with it (CR 702.26g). Null when nothing would phase out.
 */
export function phaseOutEvent(state: Pick<GameState, 'cards'>, ids: readonly InstanceId[]): { t: 'PhasedOut'; cards: InstanceId[]; indirect: { card: InstanceId; host: InstanceId }[] } | null {
  const cards = ids.filter((id, i) => ids.indexOf(id) === i && state.cards[id]?.zone.kind === 'battlefield' && state.cards[id]?.phasedOut !== true);
  if (cards.length === 0) return null;
  const indirect: { card: InstanceId; host: InstanceId }[] = [];
  for (const host of cards) {
    for (const card of state.cards[host]?.attachments ?? []) {
      if (cards.includes(card) || state.cards[card]?.phasedOut === true) continue;
      indirect.push({ card, host });
    }
  }
  return { t: 'PhasedOut', cards, indirect };
}

/** Hidden from everyone but its owner: a library, or a hand that is not yours. */
export function isHiddenZone(kind: ZoneRef['kind']): boolean {
  return kind === 'library' || kind === 'hand';
}

export function isPublicZone(kind: ZoneRef['kind']): boolean {
  return kind === 'battlefield' || kind === 'graveyard' || kind === 'exile' || kind === 'command' || kind === 'stack';
}
