import {defineConfig,mergeConfig} from 'vite';
import templateConfig from './vite.config';
import {resolve} from 'node:path';

// App-owned build configuration. The device runtime's original config stays intact.
export default mergeConfig(templateConfig,defineConfig({
 build:{rolldownOptions:{input:{app:resolve('index.html'),admin:resolve('admin.html')},output:{codeSplitting:{groups:[{name:'vendor',test:/node_modules/}]}}}},
}));
