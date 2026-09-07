let bookingsChart, trendChart;

// Navigation
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section + '-section').classList.add('active');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    if (event && event.target) event.target.closest('.menu-item').classList.add('active');
    
    const titles = { 
        dashboard: 'Tableau de bord', 
        bookings: 'Réservations', 
        transports: 'Transports', 
        hotels: 'Hôtels', 
        restaurants: 'Restaurants', 
        parks: 'Parcs & Sites' 
    };
    document.getElementById('page-title').innerText = titles[section];
    
    if (section === 'dashboard') loadDashboard();
    if (section === 'bookings') loadAllBookings();
    if (section === 'transports') loadTransports();
    if (section === 'hotels') loadHotels();
    if (section === 'restaurants') loadRestaurants();
    if (section === 'parks') loadParks();
}

async function loadDashboard() {
    try {
        const transports = await fetch('/api/transports').then(r => r.json());
        const hotels = await fetch('/api/hotels').then(r => r.json());
        const restaurants = await fetch('/api/restaurants').then(r => r.json());
        const parks = await fetch('/api/parks').then(r => r.json());
        
        document.getElementById('stat-transport').innerText = transports.length || 0;
        document.getElementById('stat-hotel').innerText = hotels.length || 0;
        document.getElementById('stat-restaurant').innerText = restaurants.length || 0;
        document.getElementById('stat-park').innerText = parks.length || 0;
        
        if (bookingsChart) bookingsChart.destroy();
        const ctx1 = document.getElementById('bookings-chart').getContext('2d');
        bookingsChart = new Chart(ctx1, {
            type: 'doughnut',
            data: { labels: ['Transports', 'Hôtels', 'Restaurants', 'Parcs'], datasets: [{ data: [45, 30, 15, 10], backgroundColor: ['#2980b9', '#c0392b', '#27ae60', '#f39c12'] }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
        
        if (trendChart) trendChart.destroy();
        const ctx2 = document.getElementById('trend-chart').getContext('2d');
        trendChart = new Chart(ctx2, {
            type: 'line',
            data: { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'], datasets: [{ label: 'Réservations', data: [12, 19, 15, 25, 22, 30], borderColor: '#c0392b', tension: 0.4, fill: false }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
        
        loadRecentActivities();
    } catch(e) { console.error(e); }
}

async function loadRecentActivities() {
    const activities = [
        { icon: '🚌', title: 'Nouveau transport ajouté', time: 'Il y a 2 heures', amount: '' },
        { icon: '🏨', title: 'Hôtel Radisson Blu modifié', time: 'Hier', amount: '' },
        { icon: '🎫', title: 'Réservation #1234 confirmée', time: 'Il y a 3 jours', amount: '150 USD' }
    ];
    document.getElementById('recent-activities').innerHTML = activities.map(a => `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #eef2f7;">
            <div style="width:36px; height:36px; background:#f8f9fa; border-radius:10px; display:flex; align-items:center; justify-content:center;">${a.icon}</div>
            <div style="flex:1;"><div style="font-weight:500;">${a.title}</div><div style="font-size:0.7em; color:#95a5a6;">${a.time}</div></div>
            ${a.amount ? `<div style="color:#c0392b; font-weight:600;">${a.amount}</div>` : ''}
        </div>
    `).join('');
}

// ========== RÉSERVATIONS ==========

async function loadAllBookings() {
    try {
        const res = await fetch('/admin/bookings');
        const bookings = await res.json();
        
        if (bookings && bookings.length > 0) {
            document.getElementById('all-bookings-list').innerHTML = `
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background:#f8f9fa; border-bottom:2px solid #c0392b;">
                            <th style="padding:12px; text-align:left;">ID</th>
                            <th style="padding:12px; text-align:left;">Client</th>
                            <th style="padding:12px; text-align:left;">Service</th>
                            <th style="padding:12px; text-align:left;">Type</th>
                            <th style="padding:12px; text-align:left;">Quantité</th>
                            <th style="padding:12px; text-align:left;">Total</th>
                            <th style="padding:12px; text-align:left;">Date</th>
                            <th style="padding:12px; text-align:left;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px;">#${b.id}</td>
                                <td style="padding:10px;">${b.user_email}</td>
                                <td style="padding:10px;">${b.service_name || 'N/A'}</td>
                                <td style="padding:10px;">
                                    <span style="padding:4px 8px; border-radius:20px; font-size:0.8em; 
                                        ${b.service_type === 'transport' ? 'background:#3498db; color:white;' : 
                                          b.service_type === 'hotel' ? 'background:#e74c3c; color:white;' :
                                          b.service_type === 'restaurant' ? 'background:#e67e22; color:white;' :
                                          'background:#27ae60; color:white;'}">
                                        ${b.service_type === 'transport' ? '🚌 Transport' :
                                          b.service_type === 'hotel' ? '🏨 Hôtel' :
                                          b.service_type === 'restaurant' ? '🍽️ Restaurant' : '🏞️ Parc'}
                                    </span>
                                </td>
                                <td style="padding:10px;">${b.quantity}</td>
                                <td style="padding:10px; font-weight:bold; color:#c0392b;">${b.total_price} USD</td>
                                <td style="padding:10px;">${new Date(b.booking_date).toLocaleString()}</td>
                                <td style="padding:10px;">
                                    <button onclick="deleteBooking(${b.id})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">
                                        <i class="fas fa-trash"></i> Supprimer
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            document.getElementById('all-bookings-list').innerHTML = '<div class="empty-message">📋 Aucune réservation pour le moment</div>';
        }
    } catch(e) {
        console.error(e);
        document.getElementById('all-bookings-list').innerHTML = '<div class="empty-message">❌ Erreur de chargement des réservations</div>';
    }
}

async function deleteBooking(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette réservation ?')) {
        try {
            const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('✅ Réservation supprimée avec succès');
                loadAllBookings();
                loadDashboard();
            } else {
                const error = await res.json();
                alert('❌ Erreur: ' + (error.error || 'Suppression échouée'));
            }
        } catch(e) {
            console.error(e);
            alert('❌ Erreur lors de la suppression');
        }
    }
}

// ========== CRUD TRANSPORTS ==========

async function loadTransports() {
    try {
        const res = await fetch('/api/transports');
        const data = await res.json();
        
        console.log('Données reçues:', data); // Pour déboguer
        
        if (data && data.length > 0) {
            document.getElementById('transports-list').innerHTML = `
                <ul class="item-list">
                    ${data.map(t => {
                        // Vérifications de sécurité
                        const fromCity = t.from_city || '?';
                        const toCity = t.to_city || '?';
                        const price = t.price || 0;
                        const seats = t.max_quantity || t.available_quantity || 40;
                        const startTime = t.start_time ? new Date(t.start_time).toLocaleString() : 'Date non définie';
                        const imageUrl = t.image_url || null;
                        const serviceId = t.service_id || t.id;
                        
                        return `
                        <li>
                            <div style="display:flex; gap:15px; align-items:center; flex:1;">
                                ${imageUrl ? `
                                    <div style="width:60px; height:60px; flex-shrink:0;">
                                        <img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                        <div style="display:none; width:60px; height:60px; background:#f0f2f5; border-radius:8px; align-items:center; justify-content:center;">
                                            <i class="fas fa-bus" style="font-size:24px; color:#95a5a6;"></i>
                                        </div>
                                    </div>
                                ` : `
                                    <div style="width:60px; height:60px; flex-shrink:0; background:#f0f2f5; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                                        <i class="fas fa-bus" style="font-size:24px; color:#95a5a6;"></i>
                                    </div>
                                `}
                                <div style="flex:1">
                                    <strong><i class="fas fa-bus"></i> ${escapeHtml(fromCity)} → ${escapeHtml(toCity)}</strong><br>
                                    <small>💰 ${price} USD | 🪑 ${seats} places</small><br>
                                    <small>📅 ${startTime}</small>
                                </div>
                            </div>
                            <div>
                                <button onclick="editTransport(${serviceId})" style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-edit"></i> Modifier
                                </button>
                                <button onclick="deleteTransport(${serviceId})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-trash"></i> Supprimer
                                </button>
                            </div>
                        </li>
                    `}).join('')}
                </ul>
            `;
        } else {
            document.getElementById('transports-list').innerHTML = '<div class="empty-message">Aucun transport</div>';
        }
    } catch(e) {
        console.error('Erreur loadTransports:', e);
        document.getElementById('transports-list').innerHTML = '<div class="empty-message">Erreur de chargement: ' + e.message + '</div>';
    }
}

// Fonction pour échapper les caractères HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function loadCities() {
    try {
        const res = await fetch('/api/cities-for-transport');
        const cities = await res.json();
        const fromSelect = document.getElementById('from-city');
        const toSelect = document.getElementById('to-city');
        if (fromSelect && toSelect) {
            fromSelect.innerHTML = cities.map(c => `<option value="${c.id}">${c.name} (${c.country_name})</option>`).join('');
            toSelect.innerHTML = cities.map(c => `<option value="${c.id}">${c.name} (${c.country_name})</option>`).join('');
        }
    } catch(e) {
        console.error('Erreur chargement villes:', e);
    }
}

function openTransportModal() {
    document.getElementById('modal-title').innerText = 'Ajouter un transport';
    const form = document.getElementById('transport-form');
    if (form) form.reset();
    const idField = document.getElementById('transport-id');
    if (idField) idField.value = '';
    loadCities();
    document.getElementById('transport-modal').style.display = 'block';
}

function closeTransportModal() {
    document.getElementById('transport-modal').style.display = 'none';
}

async function editTransport(id) {
    console.log('Édition du transport ID:', id);
    
    // Vérifier que tous les éléments existent avant de continuer
    const modalTitle = document.getElementById('modal-title');
    const transportId = document.getElementById('transport-id');
    const fromSelect = document.getElementById('from-city');
    const toSelect = document.getElementById('to-city');
    const priceInput = document.getElementById('price');
    const seatsInput = document.getElementById('seats');
    const datetimeInput = document.getElementById('datetime');
    
    if (!modalTitle || !transportId || !fromSelect || !toSelect || !priceInput || !seatsInput || !datetimeInput) {
        console.error('Un ou plusieurs éléments du formulaire sont manquants');
        alert('Erreur: Formulaire incomplet. Veuillez rafraîchir la page.');
        return;
    }
    
    try {
        const res = await fetch('/api/transports');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const transports = await res.json();
        console.log('Tous les transports:', transports);
        
        const transport = transports.find(t => (t.service_id || t.id) === id);
        console.log('Transport trouvé:', transport);
        
        if (transport) {
            modalTitle.innerText = 'Modifier le transport';
            transportId.value = transport.service_id || transport.id;
            
            // Charger les villes
            const citiesRes = await fetch('/api/cities-for-transport');
            const cities = await citiesRes.json();
            
            // Remplir les selects avec sélection
            fromSelect.innerHTML = cities.map(c => 
                `<option value="${c.id}" ${c.name === transport.from_city ? 'selected' : ''}>${c.name} (${c.country_name})</option>`
            ).join('');
            
            toSelect.innerHTML = cities.map(c => 
                `<option value="${c.id}" ${c.name === transport.to_city ? 'selected' : ''}>${c.name} (${c.country_name})</option>`
            ).join('');
            
            priceInput.value = transport.price || 0;
            seatsInput.value = transport.max_quantity || transport.available_quantity || 40;
            
            if (transport.start_time) {
                const date = new Date(transport.start_time);
                if (!isNaN(date.getTime())) {
                    datetimeInput.value = date.toISOString().slice(0, 16);
                }
            }
            
            // Champ image optionnel
            const imageInput = document.getElementById('transport-image');
            if (imageInput) imageInput.value = '';
            
            document.getElementById('transport-modal').style.display = 'block';
        } else {
            alert('Transport non trouvé');
        }
    } catch(e) {
        console.error('Erreur editTransport:', e);
        alert('Erreur lors du chargement du transport: ' + e.message);
    }
}

async function deleteTransport(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce transport ?')) {
        try {
            const res = await fetch(`/api/transports/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Transport supprimé avec succès');
                loadTransports();
                loadDashboard();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch(e) {
            console.error(e);
            alert('Erreur lors de la suppression');
        }
    }
}

document.getElementById('transport-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('transport-id')?.value || '';
    const data = {
        from_city_id: parseInt(document.getElementById('from-city').value),
        to_city_id: parseInt(document.getElementById('to-city').value),
        price: parseFloat(document.getElementById('price').value),
        seats_total: parseInt(document.getElementById('seats').value),
        start_time: document.getElementById('datetime').value,
        duration: '8h'
    };
    
    const url = id ? `/api/transports/${id}` : '/api/transports';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, { 
            method: method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        
        if (res.ok) {
            alert(id ? 'Transport modifié !' : 'Transport ajouté !');
            closeTransportModal();
            loadTransports();
            loadDashboard();
        } else {
            const error = await res.json();
            alert('Erreur: ' + (error.error || 'Opération échouée'));
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors de l\'opération');
    }
});

// ========== CRUD HÔTELS ==========

async function loadHotels() {
    try {
        const res = await fetch('/api/hotels');
        const data = await res.json();
        if (data && data.length > 0) {
            document.getElementById('hotels-list').innerHTML = `
                <ul class="item-list">
                    ${data.map(h => `
                        <li>
                            <div style="display:flex; gap:15px; align-items:center; flex:1;">
                                ${h.image_url ? `
                                    <div style="width:60px; height:60px; flex-shrink:0;">
                                        <img src="${h.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                                    </div>
                                ` : `
                                    <div style="width:60px; height:60px; flex-shrink:0; background:#f0f2f5; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                                        <i class="fas fa-hotel" style="font-size:24px; color:#95a5a6;"></i>
                                    </div>
                                `}
                                <div style="flex:1">
                                    <strong><i class="fas fa-hotel"></i> ${h.name}</strong><br>
                                    <small>📍 ${h.city_name}, ${h.country_name}</small><br>
                                    <small>💰 ${h.price} USD/nuit | 🛏️ ${h.max_quantity} chambres | ⭐ ${h.rating}</small>
                                    ${h.description ? '<br><small>📝 ' + h.description.substring(0, 80) + '</small>' : ''}
                                </div>
                            </div>
                            <div>
                                <button onclick="editHotel(${h.service_id})" style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-edit"></i> Modifier
                                </button>
                                <button onclick="deleteHotel(${h.service_id})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-trash"></i> Supprimer
                                </button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `;
        } else {
            document.getElementById('hotels-list').innerHTML = '<div class="empty-message">Aucun hôtel</div>';
        }
    } catch(e) {
        console.error(e);
        document.getElementById('hotels-list').innerHTML = '<div class="empty-message">Erreur de chargement</div>';
    }
}

async function loadCitiesForHotel() {
    const res = await fetch('/api/cities-for-transport');
    const cities = await res.json();
    const select = document.getElementById('hotel-city');
    select.innerHTML = cities.map(c => `<option value="${c.id}">${c.name} (${c.country_name})</option>`).join('');
}

function openHotelModal() {
    document.getElementById('hotel-modal-title').innerText = 'Ajouter un hôtel';
    document.getElementById('hotel-form').reset();
    document.getElementById('hotel-id').value = '';
    loadCitiesForHotel();
    document.getElementById('hotel-modal').style.display = 'block';
}

function closeHotelModal() {
    document.getElementById('hotel-modal').style.display = 'none';
}

async function editHotel(id) {
    try {
        const res = await fetch('/api/hotels');
        const hotels = await res.json();
        const hotel = hotels.find(h => h.service_id === id);
        
        if (hotel) {
            document.getElementById('hotel-modal-title').innerText = 'Modifier l\'hôtel';
            document.getElementById('hotel-id').value = hotel.service_id;
            
            await loadCitiesForHotel();
            document.getElementById('hotel-name').value = hotel.name;
            document.getElementById('hotel-city').value = hotel.city_id;
            document.getElementById('hotel-description').value = hotel.description || '';
            document.getElementById('hotel-price').value = hotel.price;
            document.getElementById('hotel-rooms').value = hotel.max_quantity;
            document.getElementById('hotel-rating').value = hotel.rating;
            document.getElementById('hotel-price-range').value = hotel.price_range || '$$';
            
            document.getElementById('hotel-modal').style.display = 'block';
        } else {
            alert('Hôtel non trouvé');
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors du chargement de l\'hôtel');
    }
}

async function deleteHotel(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet hôtel ?')) {
        try {
            const res = await fetch(`/api/hotels/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Hôtel supprimé avec succès');
                loadHotels();
                loadDashboard();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch(e) {
            console.error(e);
            alert('Erreur lors de la suppression');
        }
    }
}

document.getElementById('hotel-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('hotel-id').value;
    const data = {
        name: document.getElementById('hotel-name').value,
        city_id: parseInt(document.getElementById('hotel-city').value),
        description: document.getElementById('hotel-description').value,
        price: parseFloat(document.getElementById('hotel-price').value),
        rooms: parseInt(document.getElementById('hotel-rooms').value),
        rating: parseFloat(document.getElementById('hotel-rating').value),
        price_range: document.getElementById('hotel-price-range').value
    };
    
    const url = id ? `/api/hotels/${id}` : '/api/hotels';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, { 
            method: method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        
        if (res.ok) {
            alert(id ? 'Hôtel modifié !' : 'Hôtel ajouté !');
            closeHotelModal();
            loadHotels();
            loadDashboard();
        } else {
            const error = await res.json();
            alert('Erreur: ' + (error.error || 'Opération échouée'));
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors de l\'opération');
    }
});

// ========== CRUD RESTAURANTS ==========

async function loadRestaurants() {
    try {
        const res = await fetch('/api/restaurants');
        const data = await res.json();
        if (data && data.length > 0) {
            document.getElementById('restaurants-list').innerHTML = `
                <ul class="item-list">
                    ${data.map(r => `
                        <li>
                            <div style="display:flex; gap:15px; align-items:center; flex:1;">
                                ${r.image_url ? `
                                    <div style="width:60px; height:60px; flex-shrink:0;">
                                        <img src="${r.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                                    </div>
                                ` : `
                                    <div style="width:60px; height:60px; flex-shrink:0; background:#f0f2f5; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                                        <i class="fas fa-utensils" style="font-size:24px; color:#95a5a6;"></i>
                                    </div>
                                `}
                                <div style="flex:1">
                                    <strong><i class="fas fa-utensils"></i> ${r.name}</strong><br>
                                    <small>📍 ${r.city_name}, ${r.country_name}</small><br>
                                    <small>💰 ${r.price} USD | 🍽️ ${r.max_quantity} couverts | ⭐ ${r.rating}</small><br>
                                    <small>⏱️ ${r.duration || '2h'} | ${r.price_range || '$$'}</small>
                                    ${r.description ? '<br><small>📝 ' + r.description.substring(0, 80) + '</small>' : ''}
                                </div>
                            </div>
                            <div>
                                <button onclick="editRestaurant(${r.service_id})" style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-edit"></i> Modifier
                                </button>
                                <button onclick="deleteRestaurant(${r.service_id})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-trash"></i> Supprimer
                                </button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `;
        } else {
            document.getElementById('restaurants-list').innerHTML = '<div class="empty-message">Aucun restaurant</div>';
        }
    } catch(e) {
        console.error(e);
        document.getElementById('restaurants-list').innerHTML = '<div class="empty-message">Erreur de chargement</div>';
    }
}

async function loadCitiesForRestaurant() {
    const res = await fetch('/api/cities-for-transport');
    const cities = await res.json();
    const select = document.getElementById('restaurant-city');
    select.innerHTML = cities.map(c => `<option value="${c.id}">${c.name} (${c.country_name})</option>`).join('');
}

function openRestaurantModal() {
    document.getElementById('restaurant-modal-title').innerText = 'Ajouter un restaurant';
    document.getElementById('restaurant-form').reset();
    document.getElementById('restaurant-id').value = '';
    loadCitiesForRestaurant();
    document.getElementById('restaurant-modal').style.display = 'block';
}

function closeRestaurantModal() {
    document.getElementById('restaurant-modal').style.display = 'none';
}

async function editRestaurant(id) {
    try {
        const res = await fetch('/api/restaurants');
        const restaurants = await res.json();
        const restaurant = restaurants.find(r => r.service_id === id);
        
        if (restaurant) {
            document.getElementById('restaurant-modal-title').innerText = 'Modifier le restaurant';
            document.getElementById('restaurant-id').value = restaurant.service_id;
            
            await loadCitiesForRestaurant();
            document.getElementById('restaurant-name').value = restaurant.name;
            document.getElementById('restaurant-city').value = restaurant.city_id;
            document.getElementById('restaurant-description').value = restaurant.description || '';
            document.getElementById('restaurant-price').value = restaurant.price;
            document.getElementById('restaurant-capacity').value = restaurant.max_quantity;
            document.getElementById('restaurant-duration').value = restaurant.duration || '2 heures';
            document.getElementById('restaurant-rating').value = restaurant.rating;
            document.getElementById('restaurant-price-range').value = restaurant.price_range || '$$';
            
            document.getElementById('restaurant-modal').style.display = 'block';
        } else {
            alert('Restaurant non trouvé');
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors du chargement du restaurant');
    }
}

async function deleteRestaurant(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce restaurant ?')) {
        try {
            const res = await fetch(`/api/restaurants/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Restaurant supprimé avec succès');
                loadRestaurants();
                loadDashboard();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch(e) {
            console.error(e);
            alert('Erreur lors de la suppression');
        }
    }
}

document.getElementById('restaurant-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('restaurant-id').value;
    const data = {
        name: document.getElementById('restaurant-name').value,
        city_id: parseInt(document.getElementById('restaurant-city').value),
        description: document.getElementById('restaurant-description').value,
        price: parseFloat(document.getElementById('restaurant-price').value),
        capacity: parseInt(document.getElementById('restaurant-capacity').value),
        duration: document.getElementById('restaurant-duration').value,
        rating: parseFloat(document.getElementById('restaurant-rating').value),
        price_range: document.getElementById('restaurant-price-range').value
    };
    
    const url = id ? `/api/restaurants/${id}` : '/api/restaurants';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, { 
            method: method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        
        if (res.ok) {
            alert(id ? 'Restaurant modifié !' : 'Restaurant ajouté !');
            closeRestaurantModal();
            loadRestaurants();
            loadDashboard();
        } else {
            const error = await res.json();
            alert('Erreur: ' + (error.error || 'Opération échouée'));
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors de l\'opération');
    }
});

// ========== CRUD PARCS ==========

async function loadParks() {
    try {
        const res = await fetch('/api/parks');
        const data = await res.json();
        if (data && data.length > 0) {
            document.getElementById('parks-list').innerHTML = `
                <ul class="item-list">
                    ${data.map(p => `
                        <li>
                            <div style="display:flex; gap:15px; align-items:center; flex:1;">
                                ${p.image_url ? `
                                    <div style="width:60px; height:60px; flex-shrink:0;">
                                        <img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                                    </div>
                                ` : `
                                    <div style="width:60px; height:60px; flex-shrink:0; background:#f0f2f5; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                                        <i class="fas fa-tree" style="font-size:24px; color:#95a5a6;"></i>
                                    </div>
                                `}
                                <div style="flex:1">
                                    <strong><i class="fas fa-tree"></i> ${p.name}</strong><br>
                                    <small>📍 ${p.city_name}, ${p.country_name}</small><br>
                                    <small>💰 ${p.price} USD | 👥 ${p.max_quantity} visiteurs/jour | ⭐ ${p.rating}</small><br>
                                    <small>⏱️ ${p.duration || '1 journée'} | ${p.price_range || '$$'}</small>
                                    ${p.description ? '<br><small>📝 ' + p.description.substring(0, 80) + '</small>' : ''}
                                </div>
                            </div>
                            <div>
                                <button onclick="editPark(${p.service_id})" style="background:#3498db; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-edit"></i> Modifier
                                </button>
                                <button onclick="deletePark(${p.service_id})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:6px; margin:2px; cursor:pointer;">
                                    <i class="fas fa-trash"></i> Supprimer
                                </button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `;
        } else {
            document.getElementById('parks-list').innerHTML = '<div class="empty-message">Aucun parc</div>';
        }
    } catch(e) {
        console.error(e);
        document.getElementById('parks-list').innerHTML = '<div class="empty-message">Erreur de chargement</div>';
    }
}

async function loadCitiesForPark() {
    const res = await fetch('/api/cities-for-transport');
    const cities = await res.json();
    const select = document.getElementById('park-city');
    select.innerHTML = cities.map(c => `<option value="${c.id}">${c.name} (${c.country_name})</option>`).join('');
}

function openParkModal() {
    document.getElementById('park-modal-title').innerText = 'Ajouter un parc / site';
    document.getElementById('park-form').reset();
    document.getElementById('park-id').value = '';
    loadCitiesForPark();
    document.getElementById('park-modal').style.display = 'block';
}

function closeParkModal() {
    document.getElementById('park-modal').style.display = 'none';
}

async function editPark(id) {
    try {
        const res = await fetch('/api/parks');
        const parks = await res.json();
        const park = parks.find(p => p.service_id === id);
        
        if (park) {
            document.getElementById('park-modal-title').innerText = 'Modifier le parc / site';
            document.getElementById('park-id').value = park.service_id;
            
            await loadCitiesForPark();
            document.getElementById('park-name').value = park.name;
            document.getElementById('park-city').value = park.city_id;
            document.getElementById('park-description').value = park.description || '';
            document.getElementById('park-price').value = park.price;
            document.getElementById('park-capacity').value = park.max_quantity;
            document.getElementById('park-duration').value = park.duration || '1 journée';
            document.getElementById('park-rating').value = park.rating;
            document.getElementById('park-price-range').value = park.price_range || '$$';
            
            document.getElementById('park-modal').style.display = 'block';
        } else {
            alert('Parc non trouvé');
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors du chargement du parc');
    }
}

async function deletePark(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce parc ?')) {
        try {
            const res = await fetch(`/api/parks/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('Parc supprimé avec succès');
                loadParks();
                loadDashboard();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch(e) {
            console.error(e);
            alert('Erreur lors de la suppression');
        }
    }
}

document.getElementById('park-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('park-id').value;
    const data = {
        name: document.getElementById('park-name').value,
        city_id: parseInt(document.getElementById('park-city').value),
        description: document.getElementById('park-description').value,
        price: parseFloat(document.getElementById('park-price').value),
        capacity: parseInt(document.getElementById('park-capacity').value),
        duration: document.getElementById('park-duration').value,
        rating: parseFloat(document.getElementById('park-rating').value),
        price_range: document.getElementById('park-price-range').value
    };
    
    const url = id ? `/api/parks/${id}` : '/api/parks';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, { 
            method: method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        
        if (res.ok) {
            alert(id ? 'Parc modifié !' : 'Parc ajouté !');
            closeParkModal();
            loadParks();
            loadDashboard();
        } else {
            const error = await res.json();
            alert('Erreur: ' + (error.error || 'Opération échouée'));
        }
    } catch(e) {
        console.error(e);
        alert('Erreur lors de l\'opération');
    }
});

// Prévisualisation de l'image
function setupImagePreview(inputId, previewId, type) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.addEventListener('change', function(e) {
        const preview = document.getElementById(previewId);
        const file = e.target.files[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                preview.style.display = 'block';
                preview.querySelector('img').src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    });
}

// Effacer l'image sélectionnée
function clearImage(type) {
    const input = document.getElementById(`${type}-image`);
    const preview = document.getElementById(`${type}-image-preview`);
    if (input) input.value = '';
    if (preview) preview.style.display = 'none';
}

// Initialiser les prévisualisations
document.addEventListener('DOMContentLoaded', () => {
    setupImagePreview('transport-image', 'transport-image-preview', 'transport');
    setupImagePreview('hotel-image', 'hotel-image-preview', 'hotel');
    setupImagePreview('restaurant-image', 'restaurant-image-preview', 'restaurant');
    setupImagePreview('park-image', 'park-image-preview', 'park');
});

// Initialisation
loadDashboard();