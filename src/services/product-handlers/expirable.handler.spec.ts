import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {ExpirableProductHandler} from './expirable.handler.js';
import {Product} from '@/domain/product.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

const dayMs = 24 * 60 * 60 * 1000;

describe('ExpirableProductHandler', () => {
	let notifications: DeepMockProxy<INotificationService>;
	let products: DeepMockProxy<ProductRepository>;
	let handler: ExpirableProductHandler;
	const now = new Date('2026-07-15T12:00:00.000Z');

	beforeEach(() => {
		notifications = mockDeep<INotificationService>();
		products = mockDeep<ProductRepository>();
		handler = new ExpirableProductHandler(() => now);
	});

	it('decrements when not expired and in stock', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 8, type: 'EXPIRABLE', name: 'Butter',
			expiryDate: new Date(now.getTime() + (10 * dayMs)),
			seasonStartDate: null, seasonEndDate: null,
		});
		products.decrementStock.mockResolvedValue(true);

		await handler.process(product, {notifications, products});

		expect(products.decrementStock).toHaveBeenCalledWith(1);
		expect(notifications.sendExpirationNotification).not.toHaveBeenCalled();
	});

	it('falls back to delay when decrement loses the race on unexpired stock', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 7, available: 1, type: 'EXPIRABLE', name: 'Yogurt',
			expiryDate: new Date(now.getTime() + (10 * dayMs)),
			seasonStartDate: null, seasonEndDate: null,
		});
		products.decrementStock.mockResolvedValue(false);

		await handler.process(product, {notifications, products});

		expect(notifications.sendDelayNotification).toHaveBeenCalledWith(7, 'Yogurt');
		expect(notifications.sendExpirationNotification).not.toHaveBeenCalled();
	});

	it('notifies expiration when past expiry', async () => {
		const expiryDate = new Date(now.getTime() - (2 * dayMs));
		const product = Product.fromRow({
			id: 1, leadTime: 5, available: 6, type: 'EXPIRABLE', name: 'Milk',
			expiryDate, seasonStartDate: null, seasonEndDate: null,
		});

		await handler.process(product, {notifications, products});

		expect(notifications.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
		expect(products.updateAvailable).toHaveBeenCalledWith(1, 0);
		expect(products.decrementStock).not.toHaveBeenCalled();
	});

	it('announces delay when out of stock but not expired', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 7, available: 0, type: 'EXPIRABLE', name: 'Yogurt',
			expiryDate: new Date(now.getTime() + (10 * dayMs)),
			seasonStartDate: null, seasonEndDate: null,
		});

		await handler.process(product, {notifications, products});

		expect(notifications.sendDelayNotification).toHaveBeenCalledWith(7, 'Yogurt');
		expect(notifications.sendExpirationNotification).not.toHaveBeenCalled();
	});
});
