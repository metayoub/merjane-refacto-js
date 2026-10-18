import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {NormalProductHandler} from './normal.handler.js';
import {Product} from '@/domain/product.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

describe('NormalProductHandler', () => {
	let notifications: DeepMockProxy<INotificationService>;
	let products: DeepMockProxy<ProductRepository>;
	let handler: NormalProductHandler;

	beforeEach(() => {
		notifications = mockDeep<INotificationService>();
		products = mockDeep<ProductRepository>();
		handler = new NormalProductHandler();
	});

	it('decrements stock when available', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 15, available: 4, type: 'NORMAL', name: 'USB Cable',
			expiryDate: null, seasonStartDate: null, seasonEndDate: null,
		});
		products.decrementStock.mockResolvedValue(true);

		await handler.process(product, {notifications, products});

		expect(products.decrementStock).toHaveBeenCalledWith(1);
		expect(notifications.sendDelayNotification).not.toHaveBeenCalled();
	});

	it('falls back to delay when conditional decrement loses the race', async () => {
		const product = Product.fromRow({
			id: 1, leadTime: 15, available: 1, type: 'NORMAL', name: 'USB Cable',
			expiryDate: null, seasonStartDate: null, seasonEndDate: null,
		});
		products.decrementStock.mockResolvedValue(false);

		await handler.process(product, {notifications, products});

		expect(products.decrementStock).toHaveBeenCalledWith(1);
		expect(notifications.sendDelayNotification).toHaveBeenCalledWith(15, 'USB Cable');
	});

	it('announces delay when out of stock including leadTime 0', async () => {
		const product = Product.fromRow({
			id: 2, leadTime: 0, available: 0, type: 'NORMAL', name: 'Dongle',
			expiryDate: null, seasonStartDate: null, seasonEndDate: null,
		});

		await handler.process(product, {notifications, products});

		expect(products.decrementStock).not.toHaveBeenCalled();
		expect(notifications.sendDelayNotification).toHaveBeenCalledWith(0, 'Dongle');
	});
});
