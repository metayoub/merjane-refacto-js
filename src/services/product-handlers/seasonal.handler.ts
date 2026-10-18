import {type ProcessContext, type ProductHandler} from './product-handler.js';
import {type Product} from '@/domain/product.js';

export class SeasonalProductHandler implements ProductHandler {
	public constructor(private readonly clock: () => Date = () => new Date()) {}

	public async process(product: Product, context: ProcessContext): Promise<void> {
		const now = this.clock();
		const {notifications, products} = context;

		if (product.isInSeason(now) && product.hasStock()) {
			const decremented = await products.decrementStock(product.id);
			if (decremented) {
				return;
			}
		}

		if (product.isBeforeSeason(now) || product.isAfterSeason(now)) {
			notifications.sendOutOfStockNotification(product.name);
			return;
		}

		if (product.isRestockWithinSeason(now)) {
			await products.updateLeadTime(product.id, product.leadTime);
			notifications.sendDelayNotification(product.leadTime, product.name);
			return;
		}

		notifications.sendOutOfStockNotification(product.name);
		await products.updateAvailable(product.id, 0);
	}
}
