// Weather App JavaScript

class WeatherApp {
    constructor() {
        this.currentUnit = 'celsius';
        this.currentLocation = null;
        this.weatherCache = new Map();
        this.searchTimeout = null;
        
        // Weather code mappings for Open-Meteo
        this.weatherCodes = {
            0: { icon: '☀️', description: 'Clear sky' },
            1: { icon: '🌤️', description: 'Mainly clear' },
            2: { icon: '⛅', description: 'Partly cloudy' },
            3: { icon: '☁️', description: 'Overcast' },
            45: { icon: '🌫️', description: 'Fog' },
            48: { icon: '🌫️', description: 'Depositing rime fog' },
            51: { icon: '🌦️', description: 'Light drizzle' },
            53: { icon: '🌧️', description: 'Moderate drizzle' },
            55: { icon: '🌧️', description: 'Dense drizzle' },
            61: { icon: '🌧️', description: 'Slight rain' },
            63: { icon: '🌧️', description: 'Moderate rain' },
            65: { icon: '🌧️', description: 'Heavy rain' },
            71: { icon: '🌨️', description: 'Slight snow' },
            73: { icon: '🌨️', description: 'Moderate snow' },
            75: { icon: '❄️', description: 'Heavy snow' },
            77: { icon: '🌨️', description: 'Snow grains' },
            80: { icon: '🌦️', description: 'Slight rain showers' },
            81: { icon: '🌧️', description: 'Moderate rain showers' },
            82: { icon: '⛈️', description: 'Violent rain showers' },
            85: { icon: '🌨️', description: 'Slight snow showers' },
            86: { icon: '❄️', description: 'Heavy snow showers' },
            95: { icon: '⛈️', description: 'Thunderstorm' },
            96: { icon: '⛈️', description: 'Thunderstorm with hail' },
            99: { icon: '⛈️', description: 'Heavy thunderstorm with hail' }
        };

        this.initializeApp();
    }

    async initializeApp() {
        this.bindEvents();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 60000); // Update every minute
        
        // Show location permission modal first
        this.showLocationPermissionModal();
    }

    bindEvents() {
        // Location permission modal
        document.getElementById('allow-location').addEventListener('click', () => this.handleAllowLocation());
        document.getElementById('deny-location').addEventListener('click', () => this.handleDenyLocation());

        // Search functionality - make sure elements exist
        const searchInput = document.getElementById('location-search');
        const searchBtn = document.getElementById('search-btn');
        
        if (searchInput && searchBtn) {
            // Input event for real-time suggestions
            searchInput.addEventListener('input', (e) => {
                console.log('Search input:', e.target.value); // Debug log
                this.handleSearchInput(e);
            });
            
            // Enter key for search
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Enter pressed, searching...'); // Debug log
                    this.handleSearch();
                }
            });
            
            // Search button click
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Search button clicked'); // Debug log
                this.handleSearch();
            });

            // Focus event to show that search is active
            searchInput.addEventListener('focus', () => {
                searchInput.style.borderColor = 'var(--color-primary)';
            });

            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    this.hideSuggestions();
                }, 200); // Delay to allow suggestion clicks
            });
        }

        // Temperature toggle
        const tempToggle = document.getElementById('temp-toggle');
        if (tempToggle) {
            tempToggle.addEventListener('click', () => this.toggleTemperatureUnit());
        }

        // Current location button
        const locationBtn = document.getElementById('current-location-btn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => this.getCurrentLocation());
        }

        // Modal events
        const closeError = document.getElementById('close-error');
        const retryBtn = document.getElementById('retry-btn');
        if (closeError) closeError.addEventListener('click', () => this.hideErrorModal());
        if (retryBtn) retryBtn.addEventListener('click', () => this.retryWeatherFetch());

        // Click outside suggestions to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSuggestions();
            }
        });
    }

    showLocationPermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideLocationPermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async handleAllowLocation() {
        this.hideLocationPermissionModal();
        await this.getCurrentLocation();
    }

    async handleDenyLocation() {
        this.hideLocationPermissionModal();
        this.showLoading();
        // Use London as default
        await this.fetchWeatherData(51.5074, -0.1278);
        this.currentLocation = { lat: 51.5074, lon: -0.1278, name: 'London, UK' };
        this.hideLoading();
    }

    showLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        const dateElement = document.getElementById('current-date');
        const updateElement = document.getElementById('last-updated');
        
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
        if (updateElement) {
            updateElement.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
    }

    async getCurrentLocation() {
        this.showLoading();
        
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser.');
            this.hideLoading();
            return;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    enableHighAccuracy: true
                });
            });

            const { latitude, longitude } = position.coords;
            await this.fetchWeatherData(latitude, longitude);
            
            // Get location name from reverse geocoding
            try {
                const locationName = await this.reverseGeocode(latitude, longitude);
                this.currentLocation = { lat: latitude, lon: longitude, name: locationName };
            } catch (error) {
                this.currentLocation = { lat: latitude, lon: longitude, name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` };
            }

        } catch (error) {
            console.error('Geolocation error:', error);
            // Fallback to a default location (London)
            await this.fetchWeatherData(51.5074, -0.1278);
            this.currentLocation = { lat: 51.5074, lon: -0.1278, name: 'London, UK' };
            this.showError('Unable to get your location. Showing weather for London.');
        }

        this.hideLoading();
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1`);
            if (!response.ok) throw new Error('Reverse geocoding failed');
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                return `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`;
            }
            
            return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        }
    }

    async handleSearchInput(e) {
        const query = e.target.value.trim();
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        console.log(`Searching for: ${query}`); // Debug log

        this.searchTimeout = setTimeout(async () => {
            await this.searchLocations(query);
        }, 300);
    }

    async searchLocations(query) {
        console.log(`Making API request for: ${query}`); // Debug log
        
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
            console.log(`API URL: ${url}`); // Debug log
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Search results:', data); // Debug log

            if (data.results && data.results.length > 0) {
                this.showSuggestions(data.results);
            } else {
                console.log('No results found');
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.hideSuggestions();
        }
    }

    showSuggestions(results) {
        console.log('Showing suggestions:', results.length); // Debug log
        
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (!suggestionsContainer) return;
        
        suggestionsContainer.innerHTML = '';

        results.forEach((result, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            const displayName = `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`;
            suggestionItem.textContent = displayName;
            
            suggestionItem.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`Selected location: ${displayName}`); // Debug log
                
                const searchInput = document.getElementById('location-search');
                if (searchInput) {
                    searchInput.value = displayName;
                }
                
                this.hideSuggestions();
                this.showLoading();
                
                try {
                    await this.fetchWeatherData(result.latitude, result.longitude);
                    this.currentLocation = { 
                        lat: result.latitude, 
                        lon: result.longitude, 
                        name: displayName 
                    };
                } catch (error) {
                    this.showError('Failed to load weather data for selected location.');
                }
                
                this.hideLoading();
            });

            suggestionsContainer.appendChild(suggestionItem);
        });

        suggestionsContainer.classList.remove('hidden');
    }

    hideSuggestions() {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.classList.add('hidden');
        }
    }

    async handleSearch() {
        const searchInput = document.getElementById('location-search');
        if (!searchInput) return;
        
        const query = searchInput.value.trim();
        if (!query) return;

        console.log(`Handling search for: ${query}`); // Debug log
        this.showLoading();

        try {
            const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                await this.fetchWeatherData(result.latitude, result.longitude);
                this.currentLocation = {
                    lat: result.latitude,
                    lon: result.longitude,
                    name: `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`
                };
            } else {
                this.showError('Location not found. Please try a different search term.');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Error searching for location. Please try again.');
        }

        this.hideLoading();
        this.hideSuggestions();
    }

    async fetchWeatherData(lat, lon) {
        const cacheKey = `${lat},${lon},${this.currentUnit}`;
        const cached = this.weatherCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
            this.updateUI(cached.data);
            return;
        }

        try {
            const tempUnit = this.currentUnit === 'celsius' ? 'celsius' : 'fahrenheit';
            const windUnit = 'kmh';
            
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,uv_index,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&forecast_days=7`;
            
            const weatherResponse = await fetch(url);
            
            if (!weatherResponse.ok) {
                throw new Error(`Weather API error: ${weatherResponse.status}`);
            }

            const weatherData = await weatherResponse.json();
            
            // Cache the data
            this.weatherCache.set(cacheKey, {
                data: weatherData,
                timestamp: Date.now()
            });

            this.updateUI(weatherData);

        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError('Unable to fetch weather data. Please try again.');
        }
    }

    updateUI(data) {
        this.updateCurrentWeather(data);
        this.updateHourlyForecast(data);
        this.updateDailyForecast(data);
        this.updateWeatherDetails(data);
        
        // Update location name
        if (this.currentLocation) {
            const locationElement = document.getElementById('current-location');
            if (locationElement) {
                locationElement.textContent = this.currentLocation.name;
            }
        }
    }

    updateCurrentWeather(data) {
        const current = data.hourly;
        const currentIndex = 0; // First hour is current
        
        const temp = Math.round(current.temperature_2m[currentIndex]);
        const weatherCode = current.weather_code[currentIndex];
        const humidity = current.relative_humidity_2m[currentIndex];
        const windSpeed = Math.round(current.wind_speed_10m[currentIndex]);
        const uvIndex = current.uv_index[currentIndex];
        
        const unit = this.currentUnit === 'celsius' ? '°C' : '°F';
        const weather = this.weatherCodes[weatherCode] || { icon: '❓', description: 'Unknown' };
        
        // Update elements safely
        this.safeUpdateElement('current-temp', `${temp}${unit}`);
        this.safeUpdateElement('current-icon', weather.icon);
        this.safeUpdateElement('current-condition', weather.description);
        this.safeUpdateElement('feels-like', `${temp}${unit}`); // Simplified for demo
        this.safeUpdateElement('current-humidity', `${humidity}%`);
        this.safeUpdateElement('current-wind', `${windSpeed} km/h`);
        this.safeUpdateElement('current-uv', uvIndex || '0');
    }

    safeUpdateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }

    updateHourlyForecast(data) {
        const hourlyContainer = document.getElementById('hourly-container');
        if (!hourlyContainer) return;
        
        hourlyContainer.innerHTML = '';
        
        const hourly = data.hourly;
        const unit = this.currentUnit === 'celsius' ? '°C' : '°F';
        
        // Show next 24 hours
        for (let i = 0; i < Math.min(24, hourly.time.length); i++) {
            const time = new Date(hourly.time[i]);
            const temp = Math.round(hourly.temperature_2m[i]);
            const weatherCode = hourly.weather_code[i];
            const precipitationProb = hourly.precipitation_probability[i] || 0;
            
            const weather = this.weatherCodes[weatherCode] || { icon: '❓', description: 'Unknown' };
            
            const hourlyCard = document.createElement('div');
            hourlyCard.className = 'hourly-card';
            
            const timeLabel = i === 0 ? 'Now' : time.getHours() + ':00';
            
            hourlyCard.innerHTML = `
                <div class="hourly-card__time">${timeLabel}</div>
                <div class="hourly-card__icon">${weather.icon}</div>
                <div class="hourly-card__temp">${temp}${unit}</div>
                ${precipitationProb > 0 ? `<div class="hourly-card__precipitation">${precipitationProb}%</div>` : ''}
            `;
            
            hourlyContainer.appendChild(hourlyCard);
        }
    }

    updateDailyForecast(data) {
        const dailyContainer = document.getElementById('daily-container');
        if (!dailyContainer) return;
        
        dailyContainer.innerHTML = '';
        
        const daily = data.daily;
        const unit = this.currentUnit === 'celsius' ? '°C' : '°F';
        
        for (let i = 0; i < daily.time.length; i++) {
            const date = new Date(daily.time[i]);
            const highTemp = Math.round(daily.temperature_2m_max[i]);
            const lowTemp = Math.round(daily.temperature_2m_min[i]);
            const weatherCode = daily.weather_code[i];
            const precipitationProb = daily.precipitation_probability_max[i] || 0;
            
            const weather = this.weatherCodes[weatherCode] || { icon: '❓', description: 'Unknown' };
            
            const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const dailyCard = document.createElement('div');
            dailyCard.className = 'daily-card';
            
            dailyCard.innerHTML = `
                <div class="daily-card__header">
                    <div>
                        <div class="daily-card__day">${dayName}</div>
                        <div class="daily-card__date">${dateStr}</div>
                    </div>
                    <div class="daily-card__icon">${weather.icon}</div>
                </div>
                <div class="daily-card__temps">
                    <span class="daily-card__high">${highTemp}${unit}</span>
                    <span class="daily-card__low">${lowTemp}${unit}</span>
                </div>
                <div class="daily-card__condition">${weather.description}</div>
                ${precipitationProb > 0 ? `<div class="daily-card__precipitation">🌧️ ${precipitationProb}% chance</div>` : ''}
            `;
            
            dailyContainer.appendChild(dailyCard);
        }
    }

    updateWeatherDetails(data) {
        const current = data.hourly;
        const currentIndex = 0;
        
        const humidity = current.relative_humidity_2m[currentIndex];
        const windSpeed = Math.round(current.wind_speed_10m[currentIndex]);
        const windDirection = current.wind_direction_10m[currentIndex];
        const uvIndex = current.uv_index[currentIndex] || 0;
        
        this.safeUpdateElement('detail-humidity', `${humidity}%`);
        this.safeUpdateElement('detail-wind', `${windSpeed} km/h`);
        this.safeUpdateElement('wind-direction', this.getWindDirection(windDirection));
        this.safeUpdateElement('detail-uv', Math.round(uvIndex));
        this.safeUpdateElement('uv-desc', this.getUVDescription(uvIndex));
        
        // Mock data for unavailable metrics
        this.safeUpdateElement('detail-pressure', '1013 hPa');
        this.safeUpdateElement('detail-visibility', '10 km');
        this.safeUpdateElement('detail-aqi', 'Good');
        this.safeUpdateElement('aqi-desc', 'Air quality is satisfactory');
    }

    getWindDirection(degrees) {
        if (!degrees && degrees !== 0) return 'N/A';
        
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    getUVDescription(uvIndex) {
        if (uvIndex <= 2) return 'Low';
        if (uvIndex <= 5) return 'Moderate';
        if (uvIndex <= 7) return 'High';
        if (uvIndex <= 10) return 'Very High';
        return 'Extreme';
    }

    toggleTemperatureUnit() {
        const toggle = document.getElementById('temp-toggle');
        if (!toggle) return;
        
        if (this.currentUnit === 'celsius') {
            this.currentUnit = 'fahrenheit';
            toggle.textContent = '°F';
            toggle.setAttribute('data-unit', 'fahrenheit');
        } else {
            this.currentUnit = 'celsius';
            toggle.textContent = '°C';
            toggle.setAttribute('data-unit', 'celsius');
        }
        
        // Visual feedback
        toggle.style.transform = 'scale(1.1)';
        setTimeout(() => {
            toggle.style.transform = 'scale(1)';
        }, 150);
        
        // Refresh weather data with new unit
        if (this.currentLocation) {
            this.showLoading();
            this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
            setTimeout(() => this.hideLoading(), 800);
        }
    }

    showError(message) {
        const errorModal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');
        
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        if (errorModal) {
            errorModal.classList.remove('hidden');
        }
    }

    hideErrorModal() {
        const errorModal = document.getElementById('error-modal');
        if (errorModal) {
            errorModal.classList.add('hidden');
        }
    }

    async retryWeatherFetch() {
        this.hideErrorModal();
        if (this.currentLocation) {
            this.showLoading();
            await this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
            this.hideLoading();
        } else {
            await this.getCurrentLocation();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Weather App...'); // Debug log
    new WeatherApp();
});