// ===== TOUT EN HAUT DE server.js =====
require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const { sendBookingConfirmation } = require('./email-config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { sendSmsConfirmation } = require('./sms-config');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ===== IMPORT DES VALIDATIONS =====
const { 
    validateBooking, 
    validateTransport, 
    validateHotel, 
    validateRestaurant, 
    validatePark, 
    validateLogin 
} = require('./middleware/validation');

// ===== IMPORT DU CONTROLEUR PAIEMENT =====
const paymentController = require('./controllers/paymentController');

// ===== SÉCURITÉ =====

// Helmet - Configuré pour autoriser les scripts inline
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "images.unsplash.com", "api.qrserver.com"],
            fontSrc: ["'self'", "data:", "fonts.googleapis.com", "fonts.gstatic.com"],
            connectSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));

// Rate Limiting - Protection contre les attaques
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false
});

const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Trop de réservations, veuillez réessayer dans 1 heure',
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
    standardHeaders: true,
    legacyHeaders: false
});

// Application des limiteurs
app.use(generalLimiter);

// CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://ton-domaine.com'] 
        : '*',
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ===== VARIABLES D'ENVIRONNEMENT =====
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_à_changer_en_prod';
const PORT = process.env.PORT || 3000;

// ===== CONFIGURATION UPLOAD =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Seules les images sont autorisées'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

const db = new sqlite3.Database(path.join(__dirname, process.env.DB_PATH || 'exodus.db'));

// ========== CRÉATION DES TABLES ET INSERTIONS ==========
db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS service_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        icon TEXT,
        color TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS countries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        code TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        country_id INTEGER,
        FOREIGN KEY(country_id) REFERENCES countries(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        type_id INTEGER,
        description TEXT,
        city_id INTEGER,
        rating REAL DEFAULT 0,
        price_range TEXT,
        image_url TEXT,
        FOREIGN KEY(type_id) REFERENCES service_types(id),
        FOREIGN KEY(city_id) REFERENCES cities(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER,
        name TEXT,
        description TEXT,
        price REAL,
        currency TEXT DEFAULT 'USD',
        available_quantity INTEGER,
        max_quantity INTEGER,
        start_time TEXT,
        duration TEXT,
        FOREIGN KEY(provider_id) REFERENCES providers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS unified_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        service_id INTEGER,
        quantity INTEGER,
        total_price REAL,
        special_requests TEXT,
        booking_date TEXT DEFAULT CURRENT_TIMESTAMP,
        qr_code TEXT,
        payment_reference TEXT,
        payment_status TEXT DEFAULT 'pending',
        payment_date TEXT,
        payment_method TEXT,
        currency TEXT DEFAULT 'GNF',
        payment_transaction_id TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    const serviceTypes = [
        { name: 'transport', icon: '🚌', color: '#3498db' },
        { name: 'hotel', icon: '🏨', color: '#e74c3c' },
        { name: 'restaurant', icon: '🍽️', color: '#e67e22' },
        { name: 'park', icon: '🏞️', color: '#27ae60' }
    ];

    serviceTypes.forEach(type => {
        db.run(`INSERT OR IGNORE INTO service_types (name, icon, color) VALUES (?, ?, ?)`,
            [type.name, type.icon, type.color]);
    });

    const countries = [
        { name: 'Guinée', code: 'GN' },
        { name: 'Senegal', code: 'SN' },
        { name: "Cote d'Ivoire", code: 'CI' },
        { name: 'Mali', code: 'ML' },
        { name: 'Burkina Faso', code: 'BF' },
        { name: 'Niger', code: 'NE' },
        { name: 'Togo', code: 'TG' },
        { name: 'Benin', code: 'BJ' },
        { name: 'Ghana', code: 'GH' },
        { name: 'Nigeria', code: 'NG' }
    ];

    countries.forEach(country => {
        db.run(`INSERT OR IGNORE INTO countries (name, code) VALUES (?, ?)`,
            [country.name, country.code]);
    });

    const citiesData = [
        { name: 'Conakry', country_code: 'GN' },
        { name: 'Dakar', country_code: 'SN' },
        { name: 'Abidjan', country_code: 'CI' },
        { name: 'Bamako', country_code: 'ML' },
        { name: 'Ouagadougou', country_code: 'BF' },
        { name: 'Niamey', country_code: 'NE' },
        { name: 'Lome', country_code: 'TG' },
        { name: 'Cotonou', country_code: 'BJ' },
        { name: 'Accra', country_code: 'GH' },
        { name: 'Lagos', country_code: 'NG' }
    ];

    citiesData.forEach(city => {
        db.run(`
            INSERT OR IGNORE INTO cities (name, country_id) 
            SELECT ?, id FROM countries WHERE code = ?
        `, [city.name, city.country_code]);
    });

    db.get(`SELECT COUNT(*) as count FROM admins`, (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT INTO admins (username, password, email) VALUES (?, ?, ?)`,
                ['admin', hashedPassword, 'admin@exodus-travel.com']);
            console.log('✅ Admin par défaut créé: admin / admin123');
        }
    });

    console.log('✅ Base de données initialisée');
});

// ========== AUTHENTIFICATION ADMIN ==========

function verifyAdmin(req, res, next) {
    const token = req.cookies.admin_token;
    if (!token) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide' });
    }
}

// ===== LOGIN ADMIN AVEC VALIDATION =====
app.post('/api/admin/login', loginLimiter, validateLogin, (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
        if (err || !admin) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const isValid = bcrypt.compareSync(password, admin.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        res.json({ success: true, message: 'Connexion réussie' });
    });
});

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

app.get('/api/admin/check', verifyAdmin, (req, res) => {
    res.json({ authenticated: true, admin: req.admin });
});

// ========== ROUTES API ==========

// Villes pour les formulaires
app.get('/api/cities-for-transport', (req, res) => {
    db.all(`
        SELECT c.id, c.name, co.name as country_name 
        FROM cities c 
        JOIN countries co ON c.country_id = co.id
        GROUP BY c.name, co.name
        ORDER BY co.name, c.name
    `, (err, rows) => {
        res.json(rows || []);
    });
});

// ===== TRANSPORTS =====

// Récupérer les transports
app.get('/api/transports', (req, res) => {
    db.all(`
        SELECT DISTINCT
            s.id as service_id,
            s.name,
            s.price,
            s.available_quantity,
            s.max_quantity,
            s.start_time,
            s.duration,
            p.name as provider_name,
            p.image_url,
            c1.name as from_city,
            c2.name as to_city,
            c1.id as from_city_id,
            c2.id as to_city_id
        FROM services s
        JOIN providers p ON s.provider_id = p.id
        JOIN cities c1 ON p.city_id = c1.id
        LEFT JOIN cities c2 ON p.name LIKE '%' || c2.name || '%' AND c2.id != c1.id
        WHERE p.type_id = (SELECT id FROM service_types WHERE name = 'transport')
        GROUP BY s.id
        ORDER BY s.id DESC
    `, (err, rows) => {
        if (err) {
            console.error('Erreur GET /api/transports:', err);
            res.status(500).json({ error: 'Erreur interne du serveur' });
        } else {
            res.json(rows || []);
        }
    });
});

// Ajouter un transport AVEC validation
app.post('/api/transports', verifyAdmin, upload.single('image'), validateTransport, (req, res) => {
    const { from_city_id, to_city_id, price, seats_total, start_time, duration } = req.body;

    if (from_city_id === to_city_id) {
        return res.status(400).json({ error: 'Les villes doivent être différentes' });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.get('SELECT name FROM cities WHERE id = ?', [from_city_id], (err, fromCity) => {
        if (err || !fromCity) {
            return res.status(500).json({ error: 'Ville de départ non trouvée' });
        }

        db.get('SELECT name FROM cities WHERE id = ?', [to_city_id], (err2, toCity) => {
            if (err2 || !toCity) {
                return res.status(500).json({ error: "Ville d'arrivée non trouvée" });
            }

            const providerName = `${fromCity.name} → ${toCity.name}`;
            const description = `Bus ticket from ${fromCity.name} to ${toCity.name}`;

            db.run(`
                INSERT INTO providers (name, type_id, description, city_id, price_range, rating, image_url)
                VALUES (?, (SELECT id FROM service_types WHERE name = 'transport'), ?, ?, '$$', 4.0, ?)
            `, [providerName, description, from_city_id, image_url], function(err3) {
                if (err3) {
                    return res.status(500).json({ error: 'Erreur interne du serveur' });
                }

                const providerId = this.lastID;

                db.run(`
                    INSERT INTO services (provider_id, name, description, price, available_quantity, max_quantity, start_time, duration)
                    VALUES (?, 'One Way Ticket', ?, ?, ?, ?, ?, ?)
                `, [providerId, description, price, seats_total, seats_total, start_time, duration || '8 hours'], function(err4) {
                    if (err4) {
                        res.status(500).json({ error: 'Erreur interne du serveur' });
                    } else {
                        res.json({ success: true, id: this.lastID, message: 'Transport ajouté', image_url: image_url });
                    }
                });
            });
        });
    });
});

// Modifier un transport AVEC validation
app.put('/api/transports/:id', verifyAdmin, upload.single('image'), validateTransport, (req, res) => {
    const { id } = req.params;
    const { from_city_id, to_city_id, price, seats_total, start_time, duration } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, serviceRow) => {
        if (err || !serviceRow) {
            res.status(404).json({ error: 'Transport non trouvé' });
            return;
        }

        const providerId = serviceRow.provider_id;

        db.get('SELECT name FROM cities WHERE id = ?', [from_city_id], (err2, fromCity) => {
            db.get('SELECT name FROM cities WHERE id = ?', [to_city_id], (err3, toCity) => {
                const providerName = `${fromCity?.name || ''} → ${toCity?.name || ''}`;
                const description = `Bus ticket from ${fromCity?.name || ''} to ${toCity?.name || ''}`;

                let updateQuery = 'UPDATE providers SET name = ?, description = ?, city_id = ?';
                const params = [providerName, description, from_city_id];

                if (image_url) {
                    updateQuery += ', image_url = ?';
                    params.push(image_url);
                }

                updateQuery += ' WHERE id = ?';
                params.push(providerId);

                db.run(updateQuery, params, (err4) => {
                    if (err4) {
                        res.status(500).json({ error: 'Erreur interne du serveur' });
                        return;
                    }

                    db.run(`UPDATE services SET 
                        price = ?, 
                        available_quantity = ?, 
                        max_quantity = ?, 
                        start_time = ?, 
                        duration = ?,
                        description = ?
                        WHERE id = ?`,
                        [price, seats_total, seats_total, start_time, duration || '8 hours', description, id],
                        (err5) => {
                            if (err5) {
                                res.status(500).json({ error: 'Erreur interne du serveur' });
                            } else {
                                res.json({ message: 'Transport modifié avec succès' });
                            }
                        });
                });
            });
        });
    });
});

// Supprimer un transport
app.delete('/api/transports/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Transport non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        db.run('DELETE FROM services WHERE id = ?', [id], (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                db.run('DELETE FROM providers WHERE id = ?', [providerId], (err3) => {
                    if (err3) {
                        res.status(500).json({ error: 'Erreur interne du serveur' });
                    } else {
                        res.json({ message: 'Transport supprimé avec succès' });
                    }
                });
            }
        });
    });
});

// ========== CRUD HÔTELS ==========

app.get('/api/hotels', (req, res) => {
    db.all(`
        SELECT 
            s.id as service_id,
            p.name,
            p.description,
            p.rating,
            p.city_id,
            p.image_url,
            c.name as city_name,
            co.name as country_name,
            s.price,
            s.available_quantity,
            s.max_quantity
        FROM providers p
        JOIN cities c ON p.city_id = c.id
        JOIN countries co ON c.country_id = co.id
        JOIN services s ON s.provider_id = p.id
        WHERE p.type_id = (SELECT id FROM service_types WHERE name = 'hotel')
        AND s.available_quantity > 0
        ORDER BY p.name
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
        } else {
            res.json(rows || []);
        }
    });
});

// Ajouter un hôtel AVEC validation
app.post('/api/hotels', verifyAdmin, upload.single('image'), validateHotel, (req, res) => {
    const { name, city_id, description, price, rooms, rating, price_range } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(`
        INSERT INTO providers (name, type_id, description, city_id, rating, price_range, image_url)
        VALUES (?, (SELECT id FROM service_types WHERE name = 'hotel'), ?, ?, ?, ?, ?)
    `, [name, description || '', city_id, rating || 4.0, price_range || '$$', image_url], function(err) {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
            return;
        }

        const providerId = this.lastID;

        db.run(`
            INSERT INTO services (provider_id, name, price, available_quantity, max_quantity)
            VALUES (?, 'Chambre standard', ?, ?, ?)
        `, [providerId, price, rooms, rooms], function(err2) {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                res.json({ id: this.lastID, message: 'Hôtel ajouté avec succès', image_url: image_url });
            }
        });
    });
});

// Modifier un hôtel AVEC validation
app.put('/api/hotels/:id', verifyAdmin, upload.single('image'), validateHotel, (req, res) => {
    const { id } = req.params;
    const { name, city_id, description, price, rooms, rating, price_range } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Hôtel non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        let updateQuery = 'UPDATE providers SET name = ?, description = ?, city_id = ?, rating = ?, price_range = ?';
        const params = [name, description, city_id, rating || 4.0, price_range || '$$'];

        if (image_url) {
            updateQuery += ', image_url = ?';
            params.push(image_url);
        }

        updateQuery += ' WHERE id = ?';
        params.push(providerId);

        db.run(updateQuery, params, (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
                return;
            }

            db.run(`
                UPDATE services 
                SET price = ?, available_quantity = ?, max_quantity = ?
                WHERE id = ?
            `, [price, rooms, rooms, id], (err3) => {
                if (err3) {
                    res.status(500).json({ error: 'Erreur interne du serveur' });
                } else {
                    res.json({ message: 'Hôtel modifié avec succès' });
                }
            });
        });
    });
});

// Supprimer un hôtel
app.delete('/api/hotels/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Hôtel non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        db.run('DELETE FROM services WHERE id = ?', [id], (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                db.run('DELETE FROM providers WHERE id = ?', [providerId], (err3) => {
                    if (err3) {
                        res.status(500).json({ error: 'Erreur interne du serveur' });
                    } else {
                        res.json({ message: 'Hôtel supprimé avec succès' });
                    }
                });
            }
        });
    });
});

// ========== CRUD RESTAURANTS ==========

app.get('/api/restaurants', (req, res) => {
    db.all(`
        SELECT 
            s.id as service_id,
            p.name,
            p.description,
            p.rating,
            p.city_id,
            p.image_url,
            c.name as city_name,
            co.name as country_name,
            s.price,
            s.available_quantity,
            s.max_quantity,
            s.duration
        FROM providers p
        JOIN cities c ON p.city_id = c.id
        JOIN countries co ON c.country_id = co.id
        JOIN services s ON s.provider_id = p.id
        WHERE p.type_id = (SELECT id FROM service_types WHERE name = 'restaurant')
        AND s.available_quantity > 0
        ORDER BY p.name
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
        } else {
            res.json(rows || []);
        }
    });
});

// Ajouter un restaurant AVEC validation
app.post('/api/restaurants', verifyAdmin, upload.single('image'), validateRestaurant, (req, res) => {
    const { name, city_id, description, price, capacity, rating, price_range, duration } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(`
        INSERT INTO providers (name, type_id, description, city_id, rating, price_range, image_url)
        VALUES (?, (SELECT id FROM service_types WHERE name = 'restaurant'), ?, ?, ?, ?, ?)
    `, [name, description || '', city_id, rating || 4.0, price_range || '$$', image_url], function(err) {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
            return;
        }

        const providerId = this.lastID;

        db.run(`
            INSERT INTO services (provider_id, name, price, available_quantity, max_quantity, duration)
            VALUES (?, 'Menu', ?, ?, ?, ?)
        `, [providerId, price, capacity, capacity, duration || '2 heures'], function(err2) {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                res.json({ id: this.lastID, message: 'Restaurant ajouté avec succès', image_url: image_url });
            }
        });
    });
});

// Modifier un restaurant AVEC validation
app.put('/api/restaurants/:id', verifyAdmin, upload.single('image'), validateRestaurant, (req, res) => {
    const { id } = req.params;
    const { name, city_id, description, price, capacity, rating, price_range, duration } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Restaurant non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        let updateQuery = 'UPDATE providers SET name = ?, description = ?, city_id = ?, rating = ?, price_range = ?';
        const params = [name, description, city_id, rating || 4.0, price_range || '$$'];

        if (image_url) {
            updateQuery += ', image_url = ?';
            params.push(image_url);
        }

        updateQuery += ' WHERE id = ?';
        params.push(providerId);

        db.run(updateQuery, params, (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
                return;
            }

            db.run(`
                UPDATE services 
                SET price = ?, available_quantity = ?, max_quantity = ?, duration = ?
                WHERE id = ?
            `, [price, capacity, capacity, duration || '2 heures', id], (err3) => {
                if (err3) {
                    res.status(500).json({ error: 'Erreur interne du serveur' });
                } else {
                    res.json({ message: 'Restaurant modifié avec succès' });
                }
            });
        });
    });
});

// Supprimer un restaurant
app.delete('/api/restaurants/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Restaurant non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        db.run('DELETE FROM services WHERE id = ?', [id], (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                db.run('DELETE FROM providers WHERE id = ?', [providerId], (err3) => {
                    if (err3) {
                        res.status(500).json({ error: 'Erreur interne du serveur' });
                    } else {
                        res.json({ message: 'Restaurant supprimé avec succès' });
                    }
                });
            }
        });
    });
});

// ========== CRUD PARCS ==========

app.get('/api/parks', (req, res) => {
    db.all(`
        SELECT 
            s.id as service_id,
            p.name,
            p.description,
            p.rating,
            p.city_id,
            p.image_url,
            c.name as city_name,
            co.name as country_name,
            s.price,
            s.available_quantity,
            s.max_quantity,
            s.duration
        FROM providers p
        JOIN cities c ON p.city_id = c.id
        JOIN countries co ON c.country_id = co.id
        JOIN services s ON s.provider_id = p.id
        WHERE p.type_id = (SELECT id FROM service_types WHERE name = 'park')
        AND s.available_quantity > 0
        ORDER BY p.name
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
        } else {
            res.json(rows || []);
        }
    });
});

// Ajouter un parc AVEC validation
app.post('/api/parks', verifyAdmin, upload.single('image'), validatePark, (req, res) => {
    const { name, city_id, description, price, capacity, rating, price_range, duration } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(`
        INSERT INTO providers (name, type_id, description, city_id, rating, price_range, image_url)
        VALUES (?, (SELECT id FROM service_types WHERE name = 'park'), ?, ?, ?, ?, ?)
    `, [name, description || '', city_id, rating || 4.5, price_range || '$$', image_url], function(err) {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
            return;
        }

        const providerId = this.lastID;

        db.run(`
            INSERT INTO services (provider_id, name, price, available_quantity, max_quantity, duration)
            VALUES (?, 'Billet entree', ?, ?, ?, ?)
        `, [providerId, price, capacity, capacity, duration || '1 journee'], function(err2) {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                res.json({ id: this.lastID, message: 'Parc ajouté avec succès', image_url: image_url });
            }
        });
    });
});

// Modifier un parc AVEC validation
app.put('/api/parks/:id', verifyAdmin, upload.single('image'), validatePark, (req, res) => {
    const { id } = req.params;
    const { name, city_id, description, price, capacity, rating, price_range, duration } = req.body;

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Parc non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        let updateQuery = 'UPDATE providers SET name = ?, description = ?, city_id = ?, rating = ?, price_range = ?';
        const params = [name, description, city_id, rating || 4.5, price_range || '$$'];

        if (image_url) {
            updateQuery += ', image_url = ?';
            params.push(image_url);
        }

        updateQuery += ' WHERE id = ?';
        params.push(providerId);

        db.run(updateQuery, params, (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
                return;
            }

            db.run(`
                UPDATE services 
                SET price = ?, available_quantity = ?, max_quantity = ?, duration = ?
                WHERE id = ?
            `, [price, capacity, capacity, duration || '1 journee', id], (err3) => {
                if (err3) {
                    res.status(500).json({ error: 'Erreur interne du serveur' });
                } else {
                    res.json({ message: 'Parc modifié avec succès' });
                }
            });
        });
    });
});

// Supprimer un parc
app.delete('/api/parks/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;

    db.get('SELECT provider_id FROM services WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: 'Parc non trouvé' });
            return;
        }

        const providerId = row.provider_id;

        db.run('DELETE FROM services WHERE id = ?', [id], (err2) => {
            if (err2) {
                res.status(500).json({ error: 'Erreur interne du serveur' });
            } else {
                db.run('DELETE FROM providers WHERE id = ?', [providerId], (err3) => {
                    if (err3) {
                        res.status(500).json({ error: 'Erreur interne du serveur' });
                    } else {
                        res.json({ message: 'Parc supprimé avec succès' });
                    }
                });
            }
        });
    });
});

// ========== RÉSERVATIONS ==========

app.post('/api/book', bookingLimiter, validateBooking, async (req, res) => {
    const { service_id, quantity, user_email, phone_number, special_requests } = req.body;

    console.log('Réservation reçue:', { service_id, quantity, user_email, phone_number });

    db.get(`
        SELECT s.*, p.name as provider_name, st.name as service_type 
        FROM services s 
        JOIN providers p ON s.provider_id = p.id 
        JOIN service_types st ON p.type_id = st.id 
        WHERE s.id = ?
    `, [service_id], async (err, service) => {
        if (err || !service) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }

        if (service.start_time) {
            const now = new Date();
            const startDate = new Date(service.start_time);
            if (startDate < now) {
                return res.status(400).json({ error: "Ce service n'est plus disponible (départ déjà effectué)" });
            }
        }

        if (service.available_quantity < quantity) {
            return res.status(400).json({
                error: `Plus que ${service.available_quantity} place(s) disponible(s)`,
                available: service.available_quantity
            });
        }

        const total_price = service.price * quantity;
        const bookingRef = `EXO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const qrData = JSON.stringify({
            ref: bookingRef,
            service: service.name,
            provider: service.provider_name,
            quantity: quantity,
            total: total_price,
            email: user_email,
            date: new Date().toISOString()
        });

        const qrCodeBase64 = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

        db.run('UPDATE services SET available_quantity = available_quantity - ? WHERE id = ?',
            [quantity, service_id]);

        db.run(`INSERT INTO unified_bookings (user_email, service_id, quantity, total_price, special_requests, qr_code, booking_date)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [user_email, service_id, quantity, total_price, special_requests || '', qrCodeBase64],
            async function(err2) {
                if (err2) {
                    console.error('Erreur insertion:', err2);
                    return res.status(500).json({ error: 'Erreur interne du serveur' });
                }

                const emailSent = { email: false, sms: false };

                try {
                    const emailData = {
                        bookingRef: bookingRef,
                        serviceName: service.name,
                        providerName: service.provider_name,
                        serviceType: service.service_type,
                        quantity: quantity,
                        totalPrice: total_price,
                        qrCodeUrl: qrCodeBase64,
                        date: new Date().toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    };

                    await sendBookingConfirmation(user_email, emailData);
                    console.log(`✅ Email envoyé à ${user_email}`);
                    emailSent.email = true;
                } catch (emailError) {
                    console.error('Erreur envoi email:', emailError);
                }

                if (phone_number) {
                    try {
                        const smsData = {
                            bookingRef: bookingRef,
                            serviceName: service.name,
                            quantity: quantity,
                            totalPrice: total_price,
                            date: new Date().toLocaleString('fr-FR')
                        };
                        await sendSmsConfirmation(phone_number, smsData);
                        console.log(`✅ SMS envoyé à ${phone_number}`);
                        emailSent.sms = true;
                    } catch (smsError) {
                        console.error('Erreur envoi SMS:', smsError);
                    }
                }

                let message = 'Réservation confirmée !';
                if (emailSent.email) message += ' Un email vous a été envoyé.';
                if (emailSent.sms) message += ' Un SMS vous a été envoyé.';

                res.json({
                    success: true,
                    booking_id: this.lastID,
                    booking_reference: bookingRef,
                    total_price: total_price,
                    qr_code: qrCodeBase64,
                    message: message
                });
            });
    });
});

app.get('/admin/bookings', verifyAdmin, (req, res) => {
    db.all(`
        SELECT 
            b.id,
            b.user_email,
            b.quantity,
            b.total_price,
            b.booking_date,
            b.qr_code,
            b.payment_status,
            b.payment_reference,
            b.payment_date,
            b.currency,
            s.name as service_name,
            s.price as unit_price,
            p.name as provider_name,
            st.name as service_type
        FROM unified_bookings b
        JOIN services s ON b.service_id = s.id
        JOIN providers p ON s.provider_id = p.id
        JOIN service_types st ON p.type_id = st.id
        ORDER BY b.booking_date DESC
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Erreur interne du serveur' });
        } else {
            res.json(rows || []);
        }
    });
});

app.delete('/api/bookings/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    console.log('Suppression réservation ID:', id);

    db.get('SELECT * FROM unified_bookings WHERE id = ?', [id], (err, booking) => {
        if (err) {
            console.error('Erreur recherche:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Réservation non trouvée' });
        }

        db.run('DELETE FROM unified_bookings WHERE id = ?', [id], function(err2) {
            if (err2) {
                console.error('Erreur suppression:', err2);
                return res.status(500).json({ error: 'Erreur interne du serveur' });
            }

            console.log('Réservation supprimée, ID:', id);
            res.json({ success: true, message: 'Réservation supprimée avec succès' });
        });
    });
});

app.get('/admin/stats', verifyAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM unified_bookings`, (err, row) => {
        res.json({ total_bookings: row?.total || 0 });
    });
});

// ========== ROUTES PAIEMENT FLUTTERWAVE ==========

// Initialiser un paiement
app.post('/api/payment/initiate', paymentController.initiatePayment);

// Vérifier un paiement
app.get('/api/payment/verify/:reference', paymentController.verifyPayment);

// Callback après paiement
app.get('/api/payment/callback', paymentController.paymentCallback);

// Webhook pour les notifications automatiques
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), paymentController.paymentWebhook);

// Statut de paiement d'une réservation
app.get('/api/payment/status/:booking_id', paymentController.getPaymentStatus);

// Liste des pays supportés
app.get('/api/payment/countries', paymentController.getSupportedCountries);

// ===== FICHIERS STATIQUES =====
app.use(express.static('public'));

// ===== MIDDLEWARE D'ERREUR GLOBAL =====
app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);

    if (err.type === 'validation') {
        return res.status(400).json({ error: err.message });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Le fichier est trop volumineux (max 5MB)' });
    }

    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Erreur interne du serveur'
        : err.message;

    res.status(status).json({ error: message });
});

// ===== DÉMARRAGE DU SERVEUR =====
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📝 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌍 Paiements: Flutterwave (Guinée, Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Niger, Togo, Bénin, Ghana, Nigeria)`);
});