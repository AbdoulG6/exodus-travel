const Joi = require('joi');

// ===== SCHÉMAS DE VALIDATION =====

// Schéma pour les réservations
const bookingSchema = Joi.object({
    service_id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'L\'ID du service doit être un nombre',
            'number.integer': 'L\'ID du service doit être un nombre entier',
            'number.positive': 'L\'ID du service doit être positif',
            'any.required': 'L\'ID du service est requis'
        }),
    
    quantity: Joi.number().integer().min(1).max(100).required()
        .messages({
            'number.base': 'La quantité doit être un nombre',
            'number.integer': 'La quantité doit être un nombre entier',
            'number.min': 'La quantité doit être au moins 1',
            'number.max': 'La quantité ne peut pas dépasser 100',
            'any.required': 'La quantité est requise'
        }),
    
    user_email: Joi.string().email({ tlds: { allow: false } }).required()
        .messages({
            'string.email': 'Email invalide',
            'any.required': 'L\'email est requis'
        }),
    
    phone_number: Joi.string().pattern(/^\+?[0-9]{10,15}$/).optional()
        .messages({
            'string.pattern.base': 'Le numéro de téléphone doit être au format international (+221XXXXXXXXX)'
        }),
    
    special_requests: Joi.string().max(500).optional()
        .messages({
            'string.max': 'Les demandes spéciales ne peuvent pas dépasser 500 caractères'
        })
});

// Schéma pour les transports
const transportSchema = Joi.object({
    from_city_id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'La ville de départ doit être un nombre',
            'number.positive': 'La ville de départ doit être valide',
            'any.required': 'La ville de départ est requise'
        }),
    
    to_city_id: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'La ville d\'arrivée doit être un nombre',
            'number.positive': 'La ville d\'arrivée doit être valide',
            'any.required': 'La ville d\'arrivée est requise'
        }),
    
    price: Joi.number().positive().required()
        .messages({
            'number.base': 'Le prix doit être un nombre',
            'number.positive': 'Le prix doit être supérieur à 0',
            'any.required': 'Le prix est requis'
        }),
    
    seats_total: Joi.number().integer().min(1).max(100).required()
        .messages({
            'number.base': 'Le nombre de places doit être un nombre',
            'number.integer': 'Le nombre de places doit être un nombre entier',
            'number.min': 'Le nombre de places doit être au moins 1',
            'number.max': 'Le nombre de places ne peut pas dépasser 100',
            'any.required': 'Le nombre de places est requis'
        }),
    
    start_time: Joi.date().iso().required()
        .messages({
            'date.base': 'La date de départ doit être une date valide',
            'date.iso': 'Format de date invalide (ISO 8601)',
            'any.required': 'La date de départ est requise'
        }),
    
    duration: Joi.string().optional()
});

// Schéma pour les hôtels
const hotelSchema = Joi.object({
    name: Joi.string().min(2).max(100).required()
        .messages({
            'string.min': 'Le nom doit contenir au moins 2 caractères',
            'string.max': 'Le nom ne peut pas dépasser 100 caractères',
            'any.required': 'Le nom est requis'
        }),
    
    city_id: Joi.number().integer().positive().required(),
    description: Joi.string().max(500).optional(),
    price: Joi.number().positive().required(),
    rooms: Joi.number().integer().min(1).required(),
    rating: Joi.number().min(0).max(5).optional(),
    price_range: Joi.string().valid('$', '$$', '$$$').optional()
});

// Schéma pour les restaurants
const restaurantSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    city_id: Joi.number().integer().positive().required(),
    description: Joi.string().max(500).optional(),
    price: Joi.number().positive().required(),
    capacity: Joi.number().integer().min(1).required(),
    rating: Joi.number().min(0).max(5).optional(),
    price_range: Joi.string().valid('$', '$$', '$$$').optional(),
    duration: Joi.string().optional()
});

// Schéma pour les parcs
const parkSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    city_id: Joi.number().integer().positive().required(),
    description: Joi.string().max(500).optional(),
    price: Joi.number().positive().required(),
    capacity: Joi.number().integer().min(1).required(),
    rating: Joi.number().min(0).max(5).optional(),
    price_range: Joi.string().valid('$', '$$', '$$$').optional(),
    duration: Joi.string().optional()
});

// Schéma pour le login admin
const loginSchema = Joi.object({
    username: Joi.string().min(3).max(30).required()
        .messages({
            'string.min': 'Le nom d\'utilisateur doit contenir au moins 3 caractères',
            'any.required': 'Le nom d\'utilisateur est requis'
        }),
    password: Joi.string().min(4).required()
        .messages({
            'string.min': 'Le mot de passe doit contenir au moins 4 caractères',
            'any.required': 'Le mot de passe est requis'
        })
});

// ===== MIDDLEWARES DE VALIDATION =====

function validateBooking(req, res, next) {
    const { error } = bookingSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(d => d.message);
        return res.status(400).json({ 
            error: 'Données invalides',
            details: errors 
        });
    }
    next();
}

function validateTransport(req, res, next) {
    const { error } = transportSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(d => d.message);
        return res.status(400).json({ 
            error: 'Données invalides',
            details: errors 
        });
    }
    next();
}

function validateHotel(req, res, next) {
    const { error } = hotelSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(d => d.message);
        return res.status(400).json({ 
            error: 'Données invalides',
            details: errors 
        });
    }
    next();
}

function validateRestaurant(req, res, next) {
    const { error } = restaurantSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(d => d.message);
        return res.status(400).json({ 
            error: 'Données invalides',
            details: errors 
        });
    }
    next();
}

function validatePark(req, res, next) {
    const { error } = parkSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(d => d.message);
        return res.status(400).json({ 
            error: 'Données invalides',
            details: errors 
        });
    }
    next();
}

function validateLogin(req, res, next) {
    const { error } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errors = error.details.map(d => d.message);
        return res.status(400).json({ 
            error: 'Données invalides',
            details: errors 
        });
    }
    next();
}


// ===== EXPORT =====
module.exports = {
    validateBooking,
    validateTransport,
    validateHotel,
    validateRestaurant,
    validatePark,
    validateLogin
};