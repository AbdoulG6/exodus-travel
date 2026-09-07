const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'exodus.db'));

db.serialize(() => {
    // Vérifier si la colonne existe déjà
    db.all("PRAGMA table_info(unified_bookings)", (err, columns) => {
        if (err) {
            console.error('Erreur:', err);
            return;
        }

        const columnNames = columns.map(c => c.name);
        
        if (!columnNames.includes('payment_reference')) {
            db.run('ALTER TABLE unified_bookings ADD COLUMN payment_reference TEXT');
            console.log('✅ Colonne payment_reference ajoutée');
        }
        
        if (!columnNames.includes('payment_status')) {
            db.run('ALTER TABLE unified_bookings ADD COLUMN payment_status TEXT DEFAULT "pending"');
            console.log('✅ Colonne payment_status ajoutée');
        }
        
        if (!columnNames.includes('payment_date')) {
            db.run('ALTER TABLE unified_bookings ADD COLUMN payment_date TEXT');
            console.log('✅ Colonne payment_date ajoutée');
        }
        
        if (!columnNames.includes('payment_method')) {
            db.run('ALTER TABLE unified_bookings ADD COLUMN payment_method TEXT');
            console.log('✅ Colonne payment_method ajoutée');
        }
        
        console.log('✅ Migration terminée');
        db.close();
    });
});