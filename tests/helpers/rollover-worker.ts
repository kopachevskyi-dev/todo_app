// Child process for the rollover race test: waits until `startAt`, then runs
// rollover on its own connection to the shared database file.
import { openDatabase } from '../../src/persistence/database';
import { createRepositories } from '../../src/persistence/repositories';

const [path, now, zone, startAt] = process.argv.slice(2) as [
  string,
  string,
  string,
  string,
];
const database = openDatabase(path);
const repositories = createRepositories(database.db);
while (Date.now() < Number(startAt));
repositories.tasks.rollover(new Date(now), zone);
database.close();
