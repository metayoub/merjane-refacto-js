import {type ProcessContext, type ProductHandler} from './product-handler.js';
import {type Product} from '@/domain/product.js';

export class ExpirableProductHandler implements ProductHandler {
	public constructor(private readonly clock: () => Date = () => new Date()) {}

	public async process(product: Product, context: ProcessContext): Promise<void> {
		const now = this.clock();
		const {notifications, products} = context;

		if (product.isExpired(now) && product.expiryDate) {
			notifications.sendExpirationNotification(product.name, product.expiryDate);
			await products.updateAvailable(product.id, 0);
			return;
		}

		if (product.hasStock()) {
			const decremented = await products.decrementStock(product.id);
			if (decremented) {
				return;
			}
		}

		await products.updateLeadTime(product.id, product.leadTime);
		notifications.sendDelayNotification(product.leadTime, product.name);
	}
}
