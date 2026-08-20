import * as crypto from 'crypto';
import type { LocalStoreDB } from '../db/local-db.js';
import type { Product, Sale, SaleItem, Customer } from '@aegis/core';

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export class PosService {
  private db: LocalStoreDB;
  private cart: Map<string, CartItem> = new Map();

  constructor(db: LocalStoreDB) {
    this.db = db;
  }

  public getProducts(): Product[] {
    return Array.from(this.db.products.values()).filter((p) => p.is_active);
  }

  public getProductByBarcode(barcode: string): Product | null {
    for (const p of this.db.products.values()) {
      if (p.is_active && (p.barcode === barcode || p.sku.toLowerCase() === barcode.toLowerCase())) {
        return p;
      }
    }
    return null;
  }

  public getStock(productId: string): number {
    const inv = this.db.inventory.get(productId);
    return inv ? inv.display_quantity : 0;
  }

  public getCustomers(): Customer[] {
    return Array.from(this.db.customers.values()).filter((c) => c.is_active);
  }

  public getCustomer(id: string): Customer | null {
    return this.db.customers.get(id) || null;
  }

  // --- CART OPERATIONS ---
  public addToCart(productId: string, quantity: number = 1): CartItem {
    const product = this.db.products.get(productId);
    if (!product) throw new Error('Product not found');

    let item = this.cart.get(productId);
    if (item) {
      item.quantity += quantity;
      item.totalPrice = item.quantity * item.unitPrice;
    } else {
      item = {
        product,
        quantity,
        unitPrice: product.price,
        totalPrice: quantity * product.price
      };
      this.cart.set(productId, item);
    }
    return item;
  }

  public updateCartQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.cart.delete(productId);
      return;
    }
    const item = this.cart.get(productId);
    if (item) {
      item.quantity = quantity;
      item.totalPrice = quantity * item.unitPrice;
    }
  }

  public removeFromCart(productId: string): void {
    this.cart.delete(productId);
  }

  public clearCart(): void {
    this.cart.clear();
  }

  public getCartItems(): CartItem[] {
    return Array.from(this.cart.values());
  }

  public calculateTotals(): { subtotal: number; tax: number; total: number; itemCount: number } {
    let subtotal = 0;
    let itemCount = 0;
    for (const item of this.cart.values()) {
      subtotal += item.totalPrice;
      itemCount += item.quantity;
    }
    const tax = 0; // Standard small retail tax exempt or inclusive
    return {
      subtotal,
      tax,
      total: subtotal + tax,
      itemCount
    };
  }

  // --- CHECKOUT OPERATIONS ---
  /**
   * Cash Checkout: executes instant local write (<50ms) and computes change.
   */
  public async checkoutCash(amountPaid: number): Promise<{ sale: Sale; latencyMs: number }> {
    const items = this.getCartItems();
    if (items.length === 0) throw new Error('Cart is empty');

    const totals = this.calculateTotals();
    if (amountPaid < totals.total) {
      throw new Error(`Insufficient payment. Total: ${totals.total}, Paid: ${amountPaid}`);
    }

    const saleId = crypto.randomUUID();
    const saleItems: SaleItem[] = items.map((i) => ({
      id: crypto.randomUUID(),
      sale_id: saleId,
      product_id: i.product.id,
      sku: i.product.sku,
      name: i.product.name,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      total_price: i.totalPrice
    }));

    const result = await this.db.recordSaleLocal({
      id: saleId,
      store_id: this.db.metadata.storeId,
      device_id: this.db.metadata.deviceId,
      cashier_id: this.db.metadata.cashierId,
      sale_number: `POS-${Date.now().toString().slice(-6)}`,
      payment_type: 'cash',
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      amount_paid: amountPaid,
      change_due: amountPaid - totals.total,
      status: 'completed',
      items: saleItems,
      client_created_at: new Date().toISOString()
    });

    this.clearCart();
    return result;
  }

  /**
   * Credit Checkout: charges to customer running credit ledger.
   */
  public async checkoutCredit(customerId: string): Promise<{ sale: Sale; latencyMs: number }> {
    const customer = this.db.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');

    const items = this.getCartItems();
    if (items.length === 0) throw new Error('Cart is empty');

    const totals = this.calculateTotals();
    const prospectiveBalance = customer.current_credit_balance + totals.total;

    if (customer.credit_limit > 0 && prospectiveBalance > customer.credit_limit) {
      throw new Error(
        `Credit limit exceeded. Limit: ${customer.credit_limit}, Current: ${customer.current_credit_balance}, Sale: ${totals.total}`
      );
    }

    const saleId = crypto.randomUUID();
    const saleItems: SaleItem[] = items.map((i) => ({
      id: crypto.randomUUID(),
      sale_id: saleId,
      product_id: i.product.id,
      sku: i.product.sku,
      name: i.product.name,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      total_price: i.totalPrice
    }));

    const result = await this.db.recordSaleLocal({
      id: saleId,
      store_id: this.db.metadata.storeId,
      device_id: this.db.metadata.deviceId,
      customer_id: customerId,
      cashier_id: this.db.metadata.cashierId,
      sale_number: `POS-CR-${Date.now().toString().slice(-6)}`,
      payment_type: 'credit',
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      amount_paid: 0,
      change_due: 0,
      status: 'completed',
      items: saleItems,
      client_created_at: new Date().toISOString()
    });

    this.clearCart();
    return result;
  }

  /**
   * Atomic Bulk-to-Unit Conversion at POS counter.
   */
  public async breakBulkCarton(
    cartonProductId: string,
    cartonsToBreak: number = 1
  ): Promise<{ latencyMs: number }> {
    const carton = this.db.products.get(cartonProductId);
    if (!carton || carton.unit_type !== 'carton') {
      throw new Error('Selected product is not a bulk carton');
    }

    // Find broken-down child unit product
    let unitProduct: Product | null = null;
    for (const p of this.db.products.values()) {
      if (p.bulk_parent_id === carton.id) {
        unitProduct = p;
        break;
      }
    }

    if (!unitProduct) {
      throw new Error(`No associated single-unit product configured for ${carton.name}`);
    }

    const yieldUnits = cartonsToBreak * carton.units_per_bulk;
    return this.db.convertBulkToUnitsLocal(
      carton.id,
      unitProduct.id,
      cartonsToBreak,
      yieldUnits,
      `Broken at register by Cashier`
    );
  }
}
