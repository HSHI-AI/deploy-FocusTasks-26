import Dexie, { type Table } from 'dexie';
import { demoTasks } from './seed';
import type { LearningTask } from './types';

interface Meta { key: string; value: string; }
class FocusDatabase extends Dexie {
  tasks!: Table<LearningTask, string>;
  meta!: Table<Meta, string>;
  constructor() {
    super('FocusFlowDB');
    this.version(1).stores({ tasks: 'id, status, priority, deadline, updatedAt', meta: 'key' });
  }
}
export const db = new FocusDatabase();

export async function initDatabase(): Promise<void> {
  await db.transaction('rw', db.tasks, db.meta, async () => {
    const initialized = await db.meta.get('initialized');
    if (!initialized) {
      await db.tasks.bulkPut(demoTasks());
      await db.meta.put({ key: 'initialized', value: 'true' });
    }
  });
}
