import {SourceProductsRepository} from './repository.js';
export {SourceQueryError} from './query.js';
/** Reusable read-only query service; repository owns SQL and snapshot transactions. */
export class SourceProductsService extends SourceProductsRepository {}
export const sourceProductsService=new SourceProductsService();
