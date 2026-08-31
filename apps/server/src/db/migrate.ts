import { loadConfig } from '../config.js';
import { upgrade } from './migrator.js';

const config = loadConfig();
const applied = await upgrade(config.databaseUrl);
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Already up to date');
