import {type ProductHandler} from './product-handler.js';
import {NormalProductHandler} from './normal.handler.js';
import {SeasonalProductHandler} from './seasonal.handler.js';
import {ExpirableProductHandler} from './expirable.handler.js';
import {type ProductType} from '@/domain/product.js';

export function createProductHandlers(): Record<ProductType, ProductHandler> {
	return {
		NORMAL: new NormalProductHandler(),
		SEASONAL: new SeasonalProductHandler(),
		EXPIRABLE: new ExpirableProductHandler(),
	};
}

export type {ProductHandler, ProcessContext} from './product-handler.js';
export {NormalProductHandler} from './normal.handler.js';
export {SeasonalProductHandler} from './seasonal.handler.js';
export {ExpirableProductHandler} from './expirable.handler.js';
