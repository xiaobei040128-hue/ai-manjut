export {AppError} from '../../server/store.mjs';
import {createStore as open} from '../../server/store.mjs';
export const createStore=file=>open(file,{fixtures:true});
