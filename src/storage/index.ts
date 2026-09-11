import { DexieProjectRepository } from './repository';
import { syncRepositoryObserver } from '../sync';

export const notebookRepository = new DexieProjectRepository('creative-coding-notebook', syncRepositoryObserver);
