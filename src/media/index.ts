import { config } from '../config/env.js';
import { MediaStore } from './store.js';
export const mediaStore = new MediaStore(config.media.root, config.media.ttlHours);
