export {AppError} from '../../server/store.mjs';
import {fixtureCatalog} from './catalog.mjs';
import {createStore as open} from '../../server/store.mjs';
export const createStore=file=>open(file,{fixtures:true,fixtureCatalog});
