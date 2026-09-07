const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('exodus.db');

db.serialize(() => {
  db.run('DELETE FROM services', (err) => {
    if (err) console.error('Erreur DELETE services:', err);
    else console.log('✅ Services supprimés');
  });
  
  db.run('DELETE FROM providers WHERE type_id=(SELECT id FROM service_types WHERE name="transport")', (err) => {
    if (err) console.error('Erreur DELETE providers:', err);
    else console.log('✅ Providers transport supprimés');
  });
  
  setTimeout(() => { db.close(); }, 500);
});