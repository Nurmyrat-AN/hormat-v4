import {OptionTypesRepository} from './repository.js';
import {OptionTypesService} from './service.js';
export const paymentTypesService=new OptionTypesService(new OptionTypesRepository('payment'));
export const deliveryTypesService=new OptionTypesService(new OptionTypesRepository('delivery'));
export const orderStatusesService=new OptionTypesService(new OptionTypesRepository('order-status'));
