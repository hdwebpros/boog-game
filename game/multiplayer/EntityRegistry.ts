/**
 * Central registry for all game entities with unique IDs.
 * Enables network-addressable references instead of array indices.
 */

import { generateEntityId } from './protocol'

export type EntityType = 'player' | 'enemy' | 'boss' | 'projectile' | 'summon' | 'droppedItem' | 'npc'

export interface EntityRef {
  id: number
  type: EntityType
  entity: any
}

export class EntityRegistry {
  private entities = new Map<number, EntityRef>()
  private byType = new Map<EntityType, Set<number>>()

  constructor() {
    const types: EntityType[] = ['player', 'enemy', 'boss', 'projectile', 'summon', 'droppedItem', 'npc']
    for (const t of types) {
      this.byType.set(t, new Set())
    }
  }

  /** Register an entity and assign it a unique ID. Returns the assigned ID. */
  register(type: EntityType, entity: any, existingId?: number): number {
    const id = existingId ?? generateEntityId()
    const ref: EntityRef = { id, type, entity }
    this.entities.set(id, ref)
    this.byType.get(type)!.add(id)
    // Attach ID to entity for easy access
    entity.entityId = id
    return id
  }

  /** Remove an entity from the registry */
  unregister(id: number) {
    const ref = this.entities.get(id)
    if (ref) {
      this.byType.get(ref.type)?.delete(id)
      this.entities.delete(id)
    }
  }

  /** Get entity by ID */
  get(id: number): EntityRef | undefined {
    return this.entities.get(id)
  }

  /** Get the underlying entity object by ID */
  getEntity<T = any>(id: number): T | undefined {
    return this.entities.get(id)?.entity as T | undefined
  }

  /** Get all entities of a type */
  getByType(type: EntityType): EntityRef[] {
    const ids = this.byType.get(type)
    if (!ids) return []
    const result: EntityRef[] = []
    for (const id of ids) {
      const ref = this.entities.get(id)
      if (ref) result.push(ref)
    }
    return result
  }

  /** Get all entity IDs of a type */
  getIdsByType(type: EntityType): number[] {
    return Array.from(this.byType.get(type) ?? [])
  }

  /** Check if an ID exists */
  has(id: number): boolean {
    return this.entities.has(id)
  }

  /** Total entity count */
  get size(): number {
    return this.entities.size
  }

  /** Clear all entities */
  clear() {
    this.entities.clear()
    for (const set of this.byType.values()) {
      set.clear()
    }
  }
}
