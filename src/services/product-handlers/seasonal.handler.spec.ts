import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {SeasonalProductHandler} from './seasonal.handler.js';
import {Product} from '@/domain/product.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

const dayMs = 24 * 60 * 60 * 1000;

describe('SeasonalProductHandler', () => {
	let notifications: DeepMockProxy<INotificationService>;
	let products: DeepMockProxy<ProductRepository>;
	let handler: SeasonalProductHandler;
	const now = new Date('2026-07-15T12:00:00.000Z');

	beforeEach(() => {
		notifications = mockDeep<INotificationService>();
		products = mockDeep<ProductRepository>();
		handler = new SeasonalProductHandler(() => now);
	});

	it('decrements when in season with stock', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 10, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() - (10 * dayMs)),
			seasonEndDate: new Date(now.getTime() + (40 * dayMs)),
		});
		products.decrementStock.mockResolvedValue(true);

		await handler.process(product, {notifications, products});

		expect(products.decrementStock).toHaveBeenCalledWith(1);
	});

	it('falls back to in-season OOS policy when decrement loses the race', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 1, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() - (10 * dayMs)),
			seasonEndDate: new Date(now.getTime() + (40 * dayMs)),
		});
		products.decrementStock.mockResolvedValue(false);

		await handler.process(product, {notifications, products});

		expect(notifications.sendDelayNotification).toHaveBeenCalledWith(5, 'Melon');
	});

	it('delays when in season, OOS, restock within season', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 0, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() - (10 * dayMs)),
			seasonEndDate: new Date(now.getTime() + (40 * dayMs)),
		});

		await handler.process(product, {notifications, products});

		expect(notifications.sendDelayNotification).toHaveBeenCalledWith(5, 'Melon');
		expect(notifications.sendOutOfStockNotification).not.toHaveBeenCalled();
	});

	it('marks unavailable when in season, OOS, restock past season end', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 90, available: 0, type: 'SEASONAL', name: 'Melon',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() - (10 * dayMs)),
			seasonEndDate: new Date(now.getTime() + (10 * dayMs)),
		});

		await handler.process(product, {notifications, products});

		expect(notifications.sendOutOfStockNotification).toHaveBeenCalledWith('Melon');
		expect(products.updateAvailable).toHaveBeenCalledWith(1, 0);
	});

	it('notifies unavailability before season without wiping stock', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 30, type: 'SEASONAL', name: 'Grapes',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() + (20 * dayMs)),
			seasonEndDate: new Date(now.getTime() + (60 * dayMs)),
		});

		await handler.process(product, {notifications, products});

		expect(notifications.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		expect(products.updateAvailable).not.toHaveBeenCalled();
		expect(products.decrementStock).not.toHaveBeenCalled();
	});

	it('notifies unavailability after season without wiping stock', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 12, type: 'SEASONAL', name: 'Past',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() - (60 * dayMs)),
			seasonEndDate: new Date(now.getTime() - (5 * dayMs)),
		});

		await handler.process(product, {notifications, products});

		expect(notifications.sendOutOfStockNotification).toHaveBeenCalledWith('Past');
		expect(products.updateAvailable).not.toHaveBeenCalled();
		expect(products.decrementStock).not.toHaveBeenCalled();
	});
});
