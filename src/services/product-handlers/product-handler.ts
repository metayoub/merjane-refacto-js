import {type Product} from '@/domain/product.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

export type ProcessContext = {
	notifications: INotificationService;
	products: ProductRepository;
};

export type ProductHandler = {
	process(product: Product, context: ProcessContext): Promise<void>;
};
