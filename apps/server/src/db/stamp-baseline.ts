import { loadConfig } from '../config.js';
import { stampBaseline } from './migrator.js';

const config = loadConfig();
const stamped = await stampBaseline(config.databaseUrl);
console.log(stamped ? `Stamped baseline: ${stamped}` : 'Baseline already recorded');
