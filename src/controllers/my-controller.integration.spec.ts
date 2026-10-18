import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {type FastifyInstance} from 'fastify';
import supertest from 'supertest';
import {eq} from 'drizzle-orm';
import {type DeepMockProxy, mockDeep} from 'vitest-mock-extended';
import {asValue} from 'awilix';
import {type INotificationService} from '@/services/notifications.port.js';
import {
	type ProductInsert,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {buildFastify} from '@/fastify.js';

const dayMs = 24 * 60 * 60 * 1000;

describe('MyController Integration Tests', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notificationServiceMock: DeepMockProxy<INotificationService>;

	beforeEach(async () => {
		notificationServiceMock = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			ns: asValue(notificationServiceMock as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
	});
	afterEach(async () => {
		await fastify.close();
	});

	function processOrder(orderId: number) {
		return supertest(fastify.server).post(`/orders/${orderId}/processOrder`);
	}

	function seedOrderWithProducts(productRows: ProductInsert[]): {orderId: number; productIds: number[]} {
		return database.transaction(tx => {
			const inserted = tx.insert(products).values(productRows).returning({productId: products.id}).all();
			const order = tx.insert(orders).values([{}]).returning({orderId: orders.id}).get();
			if (!order) {
				throw new Error('failed to insert order');
			}

			const {orderId} = order;
			const productIds = inserted.map(row => row.productId);
			tx.insert(ordersToProducts).values(productIds.map(productId => ({orderId, productId}))).run();
			return {orderId, productIds};
		});
	}

	async function getAvailable(productId: number): Promise<number> {
		const row = await database.query.products.findFirst({where: eq(products.id, productId)});
		return row!.available;
	}

	it('ProcessOrderShouldReturn', async () => {
		const {orderId} = seedOrderWithProducts(createMixedCatalogue());

		await processOrder(orderId).expect(200).expect('Content-Type', /application\/json/);

		const resultOrder = await database.query.orders.findFirst({where: eq(orders.id, orderId)});
		expect(resultOrder!.id).toBe(orderId);
	});

	describe('HTTP / order integrity (already handled)', () => {
		it('returns 404 when the order does not exist and leaves products untouched', async () => {
			const {productIds} = seedOrderWithProducts([{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			}]);

			await processOrder(999_999).expect(404);

			expect(await getAvailable(productIds[0]!)).toBe(30);
		});

		it('returns 400 for a negative orderId', async () => {
			await processOrder(-1).expect(400);
		});

		it('returns 400 for a non-integer orderId', async () => {
			await supertest(fastify.server).post('/orders/1.5/processOrder').expect(400);
		});

		it('rolls back earlier stock updates when processing fails mid-order', async () => {
			const {orderId, productIds} = seedOrderWithProducts([
				{
					leadTime: 15, available: 5, type: 'NORMAL', name: 'USB Cable',
				},
				{
					leadTime: 15,
					available: 30,
					type: 'SEASONAL',
					name: 'Grapes',
					seasonStartDate: new Date(Date.now() + (180 * dayMs)),
					seasonEndDate: new Date(Date.now() + (240 * dayMs)),
				},
			]);

			notificationServiceMock.sendOutOfStockNotification.mockImplementation(() => {
				throw new Error('notification failure');
			});

			await processOrder(orderId).expect(500);

			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalled();
			expect(await getAvailable(productIds[0]!)).toBe(5);
		});
	});

	describe('NORMAL products', () => {
		it('decrements available when in stock and notifies nobody', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(29);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
		});

		it('announces delay when out of stock (leadTime > 0) and does not decrement', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('announces delay when out of stock even if leadTime is 0', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 0, available: 0, type: 'NORMAL', name: 'Zero Lead Item',
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(0, 'Zero Lead Item');
		});
	});

	describe('SEASONAL products', () => {
		it('decrements available when in season and in stock', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 15,
				available: 30,
				type: 'SEASONAL',
				name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (2 * dayMs)),
				seasonEndDate: new Date(Date.now() + (58 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(29);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('announces delay when in season, out of stock, and restock is still within the season', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 5,
				available: 0,
				type: 'SEASONAL',
				name: 'In-season OOS',
				seasonStartDate: new Date(Date.now() - (2 * dayMs)),
				seasonEndDate: new Date(Date.now() + (58 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(5, 'In-season OOS');
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('notifies unavailability when in season, out of stock, and leadTime exceeds season end', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 90,
				available: 0,
				type: 'SEASONAL',
				name: 'Late Restock',
				seasonStartDate: new Date(Date.now() - (2 * dayMs)),
				seasonEndDate: new Date(Date.now() + (10 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(0);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Late Restock');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('notifies unavailability before season start and leaves stock unchanged', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 15,
				available: 30,
				type: 'SEASONAL',
				name: 'Grapes',
				seasonStartDate: new Date(Date.now() + (180 * dayMs)),
				seasonEndDate: new Date(Date.now() + (240 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(30);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('notifies unavailability after season end and leaves remaining stock unchanged', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 15,
				available: 12,
				type: 'SEASONAL',
				name: 'Past Season',
				seasonStartDate: new Date(Date.now() - (40 * dayMs)),
				seasonEndDate: new Date(Date.now() - (2 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(12);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Past Season');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});
	});

	describe('EXPIRABLE products', () => {
		it('decrements available when not expired and in stock', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 15,
				available: 30,
				type: 'EXPIRABLE',
				name: 'Butter',
				expiryDate: new Date(Date.now() + (26 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(29);
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('notifies expiration and marks unavailable when expiry date has passed', async () => {
			const expiryDate = new Date(Date.now() - (2 * dayMs));
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 90,
				available: 6,
				type: 'EXPIRABLE',
				name: 'Milk',
				expiryDate,
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(0);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('announces delay when out of stock but not yet expired', async () => {
			const {orderId, productIds} = seedOrderWithProducts([{
				leadTime: 7,
				available: 0,
				type: 'EXPIRABLE',
				name: 'Yogurt',
				expiryDate: new Date(Date.now() + (10 * dayMs)),
			}]);

			await processOrder(orderId).expect(200);

			expect(await getAvailable(productIds[0]!)).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(7, 'Yogurt');
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
		});
	});

	function createMixedCatalogue(): ProductInsert[] {
		return [
			{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			},
			{
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			},
			{
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter', expiryDate: new Date(Date.now() + (26 * dayMs)),
			},
			{
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk', expiryDate: new Date(Date.now() - (2 * dayMs)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon', seasonStartDate: new Date(Date.now() - (2 * dayMs)), seasonEndDate: new Date(Date.now() + (58 * dayMs)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes', seasonStartDate: new Date(Date.now() + (180 * dayMs)), seasonEndDate: new Date(Date.now() + (240 * dayMs)),
			},
		];
	}
});
