import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {createProductHandlers, type ProductHandler} from '../product-handlers/index.js';
import {type Product as ProductRow} from '@/db/schema.js';
import {Product, type ProductType} from '@/domain/product.js';
import {ProductRepository} from '@/repositories/product.repository.js';

/** Dispatches each product line to the NORMAL / SEASONAL / EXPIRABLE handler. */
export class ProductService {
	private readonly notifications: INotificationService;
	private readonly products: ProductRepository;
	private readonly handlers: Record<ProductType, ProductHandler>;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.notifications = ns;
		this.products = new ProductRepository(db);
		this.handlers = createProductHandlers();
	}

	public async process(product: Product): Promise<void> {
		const handler = this.handlers[product.type];
		if (!handler) {
			throw new Error(`Unsupported product type: ${String(product.type)}`);
		}

		await handler.process(product, {
			notifications: this.notifications,
			products: this.products,
		});
	}

	/** Kept for legacy unit coverage of delay persistence; prefer process(). */
	public async notifyDelay(leadTime: number, row: ProductRow): Promise<void> {
		const product = Product.fromRow({...row, leadTime});
		await this.products.updateLeadTime(product.id, leadTime);
		this.notifications.sendDelayNotification(leadTime, product.name);
	}
}
