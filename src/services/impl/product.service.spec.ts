import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {eq} from 'drizzle-orm';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products} from '@/db/schema.js';
import {Product} from '@/domain/product.js';
import {type Database} from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let closeDatabase: () => void;

	beforeEach(async () => {
		({databaseMock, databaseName, close: closeDatabase} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => {
		closeDatabase();
		await cleanUp(databaseName);
	});

	it('should handle delay notification correctly', async () => {
		const product = Product.fromRow({
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		});
		await databaseMock.insert(products).values(product.toRow());

		await productService.notifyDelay(product.leadTime, product.toRow());

		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, 'RJ45 Cable');
		const result = await databaseMock.query.products.findFirst({
			where: eq(products.id, 1),
		});
		expect(result?.leadTime).toBe(15);
		expect(result?.available).toBe(0);
		expect(result?.name).toBe('RJ45 Cable');
	});

	it('process() decrements NORMAL products in stock', async () => {
		const product = Product.fromRow({
			id: 1,
			leadTime: 15,
			available: 3,
			type: 'NORMAL',
			name: 'USB Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		});
		await databaseMock.insert(products).values(product.toRow());

		await productService.process(product);

		const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
		expect(result?.available).toBe(2);
		expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
	});
});
