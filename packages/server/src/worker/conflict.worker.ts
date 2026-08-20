import type { AegisRepository } from '../db/repository.js';
import type { InventoryEvent, Sale } from '@aegis/core';

export class ConflictResolutionWorker {
  private repo: AegisRepository;

  constructor(repo: AegisRepository) {
    this.repo = repo;
  }

  /**
   * Applies a sale's inventory deductions deterministically.
   * Never discards a sale. When stock becomes negative due to concurrent events,
   * it clamps display quantity to 0 and records an InventoryAnomaly for manager review.
   */
  async processSaleEvent(
    storeId: string,
    deviceId: string,
    sale: Sale,
    idempotencyKey: string
  ): Promise<InventoryEvent[]> {
    const events: InventoryEvent[] = [];

    for (const item of sale.items) {
      const inv = await this.repo.getInventory(item.product_id, storeId);
      const prevQty = inv ? inv.quantity : 0;
      const newQty = prevQty - item.quantity;
      const clampedDisplay = Math.max(0, newQty);

      if (inv) {
        inv.quantity = newQty;
        inv.display_quantity = clampedDisplay;
        inv.updated_at = new Date().toISOString();
      }

      const event = await this.repo.appendInventoryEvent({
        store_id: storeId,
        device_id: deviceId,
        product_id: item.product_id,
        event_type: 'sale',
        quantity_delta: -item.quantity,
        previous_quantity: prevQty,
        new_quantity: newQty,
        causality_id: sale.id,
        idempotency_key: `${idempotencyKey}:${item.product_id}`,
        client_ts: sale.client_created_at
      });

      events.push(event);

      // Audit log entry
      await this.repo.appendAuditLog(
        storeId,
        deviceId,
        'cashier',
        'INVENTORY_DEDUCTION_SALE',
        'inventory',
        item.product_id,
        {
          saleId: sale.id,
          sku: item.sku,
          deducted: item.quantity,
          previousQuantity: prevQty,
          newQuantity: newQty
        }
      );

      // Detect negative stock conflict
      if (newQty < 0) {
        await this.repo.createAnomaly({
          store_id: storeId,
          product_id: item.product_id,
          event_id: event.id,
          conflict_type: 'negative_stock',
          calculated_stock: newQty,
          clamped_stock: clampedDisplay,
          details: `Stock depleted below zero (${newQty}) following offline sale ${sale.sale_number}. SKU: ${item.sku}. Probable concurrent inventory adjustment.`
        });
      }
    }

    return events;
  }

  /**
   * Applies a manager damage write-off.
   */
  async processDamageWriteOff(
    storeId: string,
    actorId: string,
    productId: string,
    quantity: number,
    reason: string,
    idempotencyKey: string
  ): Promise<InventoryEvent> {
    const inv = await this.repo.getInventory(productId, storeId);
    const prevQty = inv ? inv.quantity : 0;
    const newQty = prevQty - quantity;
    const clampedDisplay = Math.max(0, newQty);

    if (inv) {
      inv.quantity = newQty;
      inv.display_quantity = clampedDisplay;
      inv.updated_at = new Date().toISOString();
    }

    const event = await this.repo.appendInventoryEvent({
      store_id: storeId,
      device_id: actorId,
      product_id: productId,
      event_type: 'write_off',
      quantity_delta: -quantity,
      previous_quantity: prevQty,
      new_quantity: newQty,
      causality_id: reason,
      idempotency_key: idempotencyKey,
      client_ts: new Date().toISOString()
    });

    await this.repo.appendAuditLog(
      storeId,
      actorId,
      'manager',
      'INVENTORY_WRITE_OFF',
      'inventory',
      productId,
      {
        quantity,
        reason,
        previousQuantity: prevQty,
        newQuantity: newQty
      }
    );

    if (newQty < 0) {
      await this.repo.createAnomaly({
        store_id: storeId,
        product_id: productId,
        event_id: event.id,
        conflict_type: 'concurrent_write_off',
        calculated_stock: newQty,
        clamped_stock: clampedDisplay,
        details: `Write-off of ${quantity} units caused negative balance (${newQty}). Reason: ${reason}`
      });
    }

    return event;
  }

  /**
   * Applies atomic Bulk-to-Unit inventory conversion (e.g. 1 carton -> 100 units).
   */
  async processBulkConversion(
    storeId: string,
    actorId: string,
    cartonProductId: string,
    unitProductId: string,
    cartonsToConvert: number,
    unitsYielded: number,
    idempotencyKey: string,
    notes?: string
  ): Promise<{ cartonEvent: InventoryEvent; unitEvent: InventoryEvent }> {
    const cartonInv = await this.repo.getInventory(cartonProductId, storeId);
    const unitInv = await this.repo.getInventory(unitProductId, storeId);

    const cartonPrev = cartonInv ? cartonInv.quantity : 0;
    const unitPrev = unitInv ? unitInv.quantity : 0;

    const cartonNew = cartonPrev - cartonsToConvert;
    const unitNew = unitPrev + unitsYielded;

    if (cartonInv) {
      cartonInv.quantity = cartonNew;
      cartonInv.display_quantity = Math.max(0, cartonNew);
      cartonInv.updated_at = new Date().toISOString();
    }

    if (unitInv) {
      unitInv.quantity = unitNew;
      unitInv.display_quantity = Math.max(0, unitNew);
      unitInv.updated_at = new Date().toISOString();
    }

    const cartonEvent = await this.repo.appendInventoryEvent({
      store_id: storeId,
      device_id: actorId,
      product_id: cartonProductId,
      event_type: 'bulk_conversion',
      quantity_delta: -cartonsToConvert,
      previous_quantity: cartonPrev,
      new_quantity: cartonNew,
      causality_id: idempotencyKey,
      idempotency_key: `${idempotencyKey}:carton`,
      client_ts: new Date().toISOString()
    });

    const unitEvent = await this.repo.appendInventoryEvent({
      store_id: storeId,
      device_id: actorId,
      product_id: unitProductId,
      event_type: 'bulk_conversion',
      quantity_delta: unitsYielded,
      previous_quantity: unitPrev,
      new_quantity: unitNew,
      causality_id: idempotencyKey,
      idempotency_key: `${idempotencyKey}:unit`,
      client_ts: new Date().toISOString()
    });

    await this.repo.appendAuditLog(
      storeId,
      actorId,
      'cashier',
      'BULK_CONVERSION',
      'inventory',
      cartonProductId,
      {
        cartonProductId,
        unitProductId,
        cartonsConverted: cartonsToConvert,
        unitsYielded,
        notes
      }
    );

    return { cartonEvent, unitEvent };
  }
}
