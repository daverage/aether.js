const aether = (function() {
    'use strict';

    // --- Core State for Shared Data ---
    let stateStore = null; // Singleton store instance

    // --- Module: DOM & Observation ---

    /**
     * Waits for an element to exist in the DOM with timeout support.
     * @param {string} selector - The CSS selector for the element.
     * @param {number} [timeout=5000] - Timeout in milliseconds.
     * @returns {Promise<Element>} A promise that resolves with the element.
     */
    function waitFor(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            
            let timeoutId;
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearTimeout(timeoutId);
                    observer.disconnect();
                    resolve(el);
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    /**
     * Efficiently delegates events to child elements with cleanup tracking.
     * @param {Element|string} parent - The parent element or its selector.
     * @param {string} eventType - The event type (e.g., 'click').
     * @param {string} childSelector - The selector for the target child elements.
     * @param {Function} callback - The function to call on event.
     * @param {object} [options] - Event listener options.
     * @returns {Function} Cleanup function to remove the event listener.
     */
    function on(parent, eventType, childSelector, callback, options = {}) {
        const parentEl = typeof parent === 'string' ? document.querySelector(parent) : parent;
        if (!parentEl) {
            console.warn(`Aether.js: Parent element not found for selector: ${parent}`);
            return () => {}; // Return no-op cleanup function
        }
        
        const handler = (event) => {
            const target = event.target.closest(childSelector);
            if (target && parentEl.contains(target)) {
                callback(event, target);
            }
        };
        
        parentEl.addEventListener(eventType, handler, options);
        
        // Return cleanup function
        return () => parentEl.removeEventListener(eventType, handler, options);
    }
    
    /**
     * Observes the DOM for significant changes, useful for SPAs.
     * @param {Function} callback - A function to run when a change is detected.
     * @param {object} [options={ threshold: 10, debounceMs: 100 }] - Configuration options.
     * @returns {object} Object with disconnect method and the observer.
     */
    function onPageChange(callback, options = { threshold: 10, debounceMs: 100 }) {
        const debouncedCallback = debounce(callback, options.debounceMs);
        
        const observer = new MutationObserver(mutations => {
            let nodeCount = 0;
            for(const mutation of mutations) {
                nodeCount += mutation.addedNodes.length + mutation.removedNodes.length;
                if (nodeCount > options.threshold) break; // Early exit for performance
            }
            if (nodeCount > options.threshold) {
                debouncedCallback();
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        return {
            disconnect: () => observer.disconnect(),
            observer
        };
    }

    /**
     * Batch DOM operations to minimize reflows/repaints.
     * @param {Function} operations - Function containing DOM operations.
     * @returns {Promise} Promise that resolves after operations complete.
     */
    function batchDOM(operations) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                operations();
                resolve();
            });
        });
    }

    // --- Module: Animation ---

    /**
     * Promise-based wrapper for the Web Animations API with fallback.
     * @param {Element} element - The element to animate.
     * @param {Keyframe[]} keyframes - An array of keyframes.
     * @param {object} [options={ duration: 300 }] - Animation options.
     * @returns {Promise<Animation>} A promise that resolves when the animation finishes.
     */
    function animate(element, keyframes, options = { duration: 300 }) {
        if (!element) {
            return Promise.reject(new Error('Invalid element provided to animate'));
        }
        
        // Feature detection with fallback
        if (typeof element.animate !== 'function') {
            console.warn('Web Animations API not supported, using fallback');
            return animateFallback(element, keyframes, options);
        }
        
        return new Promise((resolve, reject) => {
            try {
                const animation = element.animate(keyframes, options);
                animation.onfinish = () => resolve(animation);
                animation.oncancel = () => reject(new Error('Animation was cancelled'));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Fallback animation using CSS transitions.
     * @private
     */
    function animateFallback(element, keyframes, options) {
        return new Promise(resolve => {
            const duration = options.duration || 300;
            const startFrame = keyframes[0] || {};
            const endFrame = keyframes[keyframes.length - 1] || {};
            
            // Apply start state
            Object.assign(element.style, startFrame);
            element.style.transition = `all ${duration}ms ease`;
            
            requestAnimationFrame(() => {
                Object.assign(element.style, endFrame);
                setTimeout(() => {
                    element.style.transition = '';
                    resolve({ finished: Promise.resolve() });
                }, duration);
            });
        });
    }

    /**
     * Fades an element in.
     * @param {Element} element - The element to animate.
     * @param {object} [options={ duration: 400 }] - Animation options.
     */
    function fadeIn(element, options = { duration: 400 }) {
        element.style.opacity = '0';
        return animate(element, [
            { opacity: 0 },
            { opacity: 1 }
        ], options);
    }

    /**
     * Fades an element out.
     * @param {Element} element - The element to animate.
     * @param {object} [options={ duration: 400 }] - Animation options.
     */
    function fadeOut(element, options = { duration: 400 }) {
        return animate(element, [
            { opacity: 1 },
            { opacity: 0 }
        ], options);
    }

    // --- Module: State Management ---

    /**
     * Creates a simple, reactive state store with improved performance.
     * @param {object} initialState - The initial state of the store.
     * @returns {object} The store instance.
     */
    function createStore(initialState) {
        let state = { ...initialState }; // Create a copy
        const subscribers = new Set();
        const bindings = new Map(); // Use Map for better performance
        const updateQueue = new Set(); // Batch updates

        let isUpdating = false;

        const handler = {
            set(target, property, value, receiver) {
                const oldValue = target[property];
                if (oldValue === value) return true; // Skip if no change
                
                const fullPath = (this.path ? this.path + '.' : '') + property;
                const success = Reflect.set(target, property, value, receiver);
                
                if (success && !isUpdating) {
                    scheduleUpdate(fullPath);
                }
                return success;
            },
            get(target, property) {
                const value = target[property];
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    return new Proxy(value, { ...handler, path: (this.path ? this.path + '.' : '') + property });
                }
                return value;
            }
        };
        
        state = new Proxy(state, handler);

        function scheduleUpdate(changedKey) {
            updateQueue.add(changedKey);
            if (!isUpdating) {
                isUpdating = true;
                requestAnimationFrame(processUpdates);
            }
        }

        function processUpdates() {
            const changedKeys = Array.from(updateQueue);
            updateQueue.clear();
            
            // Notify subscribers
            subscribers.forEach(callback => {
                try {
                    callback(state, changedKeys);
                } catch (error) {
                    console.error('Error in store subscriber:', error);
                }
            });
            
            // Update bindings
            changedKeys.forEach(changedKey => {
                for (const [key, bindingList] of bindings) {
                    if (key.startsWith(changedKey) || changedKey.startsWith(key)) {
                        bindingList.forEach(({ element, prop, transform }) => {
                            if (element && element.isConnected) {
                                try {
                                    const value = getNested(state, key);
                                    const finalValue = transform ? transform(value) : value;
                                    
                                    if (element[prop] !== finalValue) {
                                        element[prop] = finalValue;
                                    }
                                } catch (error) {
                                    console.error(`Error updating binding for ${key}:`, error);
                                }
                            }
                        });
                    }
                }
            });
            
            isUpdating = false;
        }
        
        function getNested(obj, path) {
            try {
                return path.split('.').reduce((acc, part) => acc?.[part], obj);
            } catch {
                return undefined;
            }
        }

        const store = {
            getState: () => state,
            setState: (newState, options = { merge: true }) => {
                isUpdating = true;
                try {
                    if (options.merge) {
                        Object.entries(newState).forEach(([key, value]) => {
                            state[key] = value;
                        });
                    } else {
                        // Replace entire state
                        Object.keys(state).forEach(key => delete state[key]);
                        Object.assign(state, newState);
                    }
                } finally {
                    isUpdating = false;
                    scheduleUpdate(''); // Trigger update for all keys
                }
            },
            subscribe: (callback) => {
                if (typeof callback !== 'function') {
                    throw new Error('Callback must be a function');
                }
                subscribers.add(callback);
                return () => subscribers.delete(callback);
            },
            // Add method to get subscriber count for debugging
            getSubscriberCount: () => subscribers.size,
            _addBinding: (key, element, prop, transform) => {
                if (!bindings.has(key)) {
                    bindings.set(key, []);
                }
                bindings.get(key).push({ element, prop, transform });
                
                // Initialize with current value
                try {
                    const value = getNested(state, key);
                    const finalValue = transform ? transform(value) : value;
                    element[prop] = finalValue;
                } catch (error) {
                    console.error(`Error initializing binding for ${key}:`, error);
                }
            },
            // Add method to clean up dead bindings
            _cleanupBindings: () => {
                for (const [key, bindingList] of bindings) {
                    const activeBindings = bindingList.filter(({ element }) => 
                        element && element.isConnected
                    );
                    if (activeBindings.length === 0) {
                        bindings.delete(key);
                    } else if (activeBindings.length < bindingList.length) {
                        bindings.set(key, activeBindings);
                    }
                }
            }
        };
        
        stateStore = store; // Set the singleton
        return store;
    }

    /**
     * Binds an element's property to a state key with optional transform.
     * @param {Element|string} elementOrSelector - The element or its selector.
     * @param {string} stateKey - The dot-notation key in the state (e.g., 'user.name').
     * @param {object} [options] - Binding options { prop, transform }.
     * @returns {Promise<Function>} Promise that resolves to cleanup function.
     */
    function bind(elementOrSelector, stateKey, options = {}) {
        if (!stateStore) {
            throw new Error("Aether.js: Must create a store with aether.createStore() before using bind().");
        }
        
        return waitFor(elementOrSelector).then(element => {
            const prop = options.prop || 
                (element.matches('input, textarea, select') ? 'value' : 'textContent');
            
            stateStore._addBinding(stateKey, element, prop, options.transform);
            
            // Return cleanup function
            return () => {
                // Remove this specific binding (implementation would need refinement)
                console.log(`Cleanup binding for ${stateKey}`);
            };
        }).catch(error => {
            console.error(`Failed to bind ${stateKey}:`, error);
        });
    }

    // --- Module: Web Components ---

    /**
     * Simplifies the creation of a Web Component with enhanced features.
     * @param {string} name - The tag name of the component (e.g., 'user-card').
     * @param {object} config - Configuration object.
     */
    function define(name, { 
        props = {}, 
        methods = {},
        connected, 
        disconnected,
        attributeChanged,
        template = '', 
        styles = '',
        shadowMode = 'open'
    }) {
        if (customElements.get(name)) {
            console.warn(`Component ${name} is already defined`);
            return;
        }

        customElements.define(name, class extends HTMLElement {
            static get observedAttributes() {
                return Object.keys(props);
            }

            constructor() {
                super();
                
                if (shadowMode) {
                    this.attachShadow({ mode: shadowMode });
                    this.shadowRoot.innerHTML = `
                        <style>
                            :host { display: block; }
                            ${styles}
                        </style>
                        ${template}
                    `;
                    this.root = this.shadowRoot;
                } else {
                    this.innerHTML = template;
                    this.root = this;
                }
                
                // Add methods to component
                Object.assign(this, methods);
                
                // Define properties with validation and type coercion
                Object.entries(props).forEach(([key, config]) => {
                    const propConfig = typeof config === 'object' ? config : { type: config };
                    
                    Object.defineProperty(this, key, {
                        get: () => {
                            const attr = this.getAttribute(key);
                            return this._coerceType(attr, propConfig.type);
                        },
                        set: (value) => {
                            if (propConfig.validator && !propConfig.validator(value)) {
                                console.warn(`Invalid value for prop ${key}:`, value);
                                return;
                            }
                            this.setAttribute(key, value);
                        }
                    });
                });
            }

            _coerceType(value, type) {
                if (value === null || value === undefined) return value;
                
                switch (type) {
                    case Boolean:
                        return value !== null && value !== 'false';
                    case Number:
                        return isNaN(value) ? 0 : Number(value);
                    case Array:
                        try { return JSON.parse(value); } catch { return []; }
                    case Object:
                        try { return JSON.parse(value); } catch { return {}; }
                    default:
                        return String(value);
                }
            }

            connectedCallback() {
                if (connected) {
                    try {
                        connected.call(this);
                    } catch (error) {
                        console.error(`Error in ${name} connectedCallback:`, error);
                    }
                }
            }

            disconnectedCallback() {
                if (disconnected) {
                    try {
                        disconnected.call(this);
                    } catch (error) {
                        console.error(`Error in ${name} disconnectedCallback:`, error);
                    }
                }
            }

            attributeChangedCallback(name, oldValue, newValue) {
                if (attributeChanged && oldValue !== newValue) {
                    try {
                        attributeChanged.call(this, name, oldValue, newValue);
                    } catch (error) {
                        console.error(`Error in ${name} attributeChangedCallback:`, error);
                    }
                }
            }
        });
    }
    
    // --- Module: Utilities ---

    /**
     * Creates a debounced function that delays invoking func.
     * @param {Function} func - The function to debounce.
     * @param {number} wait - The number of milliseconds to delay.
     * @param {boolean} [immediate=false] - Trigger on leading edge.
     * @returns {Function} The new debounced function.
     */
    function debounce(func, wait, immediate = false) {
        let timeout, result;
        
        const debounced = function(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) result = func.apply(this, args);
            };
            
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) result = func.apply(this, args);
            return result;
        };
        
        debounced.cancel = () => {
            clearTimeout(timeout);
            timeout = null;
        };
        
        return debounced;
    }

    /**
     * Creates a throttled function that only invokes func at most once per every `limit` milliseconds.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The minimum time interval between invocations.
     * @param {object} [options={ leading: true, trailing: true }] - Options object.
     * @returns {Function} The new throttled function.
     */
    function throttle(func, limit, options = { leading: true, trailing: true }) {
        let inThrottle, lastFunc, lastRan;
        
        return function(...args) {
            if (!inThrottle) {
                if (options.leading) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
                inThrottle = true;
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (options.trailing && Date.now() - lastRan >= limit) {
                        func.apply(this, args);
                        lastRan = Date.now();
                    }
                    inThrottle = false;
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    /**
     * Simple deep clone utility.
     * @param {*} obj - Object to clone.
     * @returns {*} Cloned object.
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
            const copy = {};
            Object.keys(obj).forEach(key => {
                copy[key] = deepClone(obj[key]);
            });
            return copy;
        }
    }
    
    // --- Module: Routing ---
    
    /**
     * Creates a lightweight SPA router with enhanced features.
     * @param {object} [options] - Router configuration options.
     * @returns {object} A router instance.
     */
    function router(options = {}) {
        const routes = [];
        const middleware = [];
        let notFoundHandler = () => console.error("404 Not Found");
        let currentRoute = null;
        let isInitialized = false;
        
        const config = {
            hashMode: false,
            baseUrl: '',
            caseSensitive: false,
            ...options
        };
        
        function getCurrentPath() {
            if (config.hashMode) {
                return window.location.hash.slice(1) || '/';
            }
            return window.location.pathname.replace(config.baseUrl, '') || '/';
        }
        
        function createRegex(path) {
            const regexStr = path
                .replace(/\//g, '\\/')
                .replace(/:\w+/g, '(?<$&>[^/]+)')
                .replace(/:\w+/g, match => match.slice(1));
            
            return new RegExp(`^${regexStr}$`, config.caseSensitive ? '' : 'i');
        }
        
        async function executeMiddleware(context) {
            for (const mw of middleware) {
                try {
                    const result = await mw(context);
                    if (result === false) return false; // Stop execution
                } catch (error) {
                    console.error('Middleware error:', error);
                    return false;
                }
            }
            return true;
        }
        
        async function checkRoutes() {
            const path = getCurrentPath();
            const context = { path, params: {}, query: {} };
            
            // Parse query string
            const queryString = window.location.search.slice(1);
            if (queryString) {
                queryString.split('&').forEach(param => {
                    const [key, value] = param.split('=').map(decodeURIComponent);
                    context.query[key] = value;
                });
            }
            
            // Find matching route
            const matchedRoute = routes.find(route => {
                const match = path.match(route.regex);
                if (match) {
                    context.params = match.groups || {};
                    return true;
                }
                return false;
            });
            
            // Execute middleware
            const shouldContinue = await executeMiddleware(context);
            if (!shouldContinue) return;
            
            if (matchedRoute) {
                currentRoute = matchedRoute;
                try {
                    await matchedRoute.handler(context);
                } catch (error) {
                    console.error('Route handler error:', error);
                    notFoundHandler(context);
                }
            } else {
                currentRoute = null;
                notFoundHandler(context);
            }
        }
        
        return {
            add: (path, handler, routeMiddleware = []) => {
                if (typeof handler !== 'function') {
                    throw new Error('Route handler must be a function');
                }
                
                const regex = createRegex(path);
                routes.push({ 
                    path, 
                    regex, 
                    handler, 
                    middleware: routeMiddleware 
                });
                
                return this; // Enable chaining
            },
            
            use: (middlewareFn) => {
                if (typeof middlewareFn !== 'function') {
                    throw new Error('Middleware must be a function');
                }
                middleware.push(middlewareFn);
                return this;
            },
            
            setNotFound: (handler) => {
                if (typeof handler !== 'function') {
                    throw new Error('Not found handler must be a function');
                }
                notFoundHandler = handler;
                return this;
            },
            
            navigate: (path, options = {}) => {
                const fullPath = config.baseUrl + path;
                
                if (config.hashMode) {
                    window.location.hash = path;
                } else {
                    if (options.replace) {
                        window.history.replaceState({}, '', fullPath);
                    } else {
                        window.history.pushState({}, '', fullPath);
                    }
                }
                
                checkRoutes();
                return this;
            },
            
            getCurrentRoute: () => currentRoute,
            
            init: () => {
                if (isInitialized) {
                    console.warn('Router already initialized');
                    return this;
                }
                
                if (config.hashMode) {
                    window.addEventListener('hashchange', checkRoutes);
                } else {
                    window.addEventListener('popstate', checkRoutes);
                }
                
                // Handle navigation links
                document.addEventListener('click', e => {
                    const link = e.target.closest('a[data-aether-link]');
                    if (link && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        const path = link.getAttribute('href');
                        if (path) {
                            this.navigate(path);
                        }
                    }
                });
                
                isInitialized = true;
                checkRoutes();
                return this;
            },
            
            destroy: () => {
                if (!isInitialized) return;
                
                if (config.hashMode) {
                    window.removeEventListener('hashchange', checkRoutes);
                } else {
                    window.removeEventListener('popstate', checkRoutes);
                }
                
                isInitialized = false;
                currentRoute = null;
            }
        };
    }

    // --- Module: Performance & Debugging ---
    
    /**
     * Simple performance monitor for development.
     * @param {string} name - Operation name.
     * @param {Function} fn - Function to measure.
     * @returns {*} Function result.
     */
    function measure(name, fn) {
        if (typeof performance === 'undefined') {
            return fn();
        }
        
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`[Aether.js] ${name}: ${(end - start).toFixed(2)}ms`);
        return result;
    }
    
    /**
     * Memory usage tracker (development only).
     */
    function getMemoryUsage() {
        if (typeof performance === 'undefined' || !performance.memory) {
            return null;
        }
        
        return {
            used: Math.round(performance.memory.usedJSHeapSize / 1048576),
            total: Math.round(performance.memory.totalJSHeapSize / 1048576),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
        };
    }

    // Clean up dead bindings periodically
    if (typeof window !== 'undefined') {
        setInterval(() => {
            if (stateStore && typeof stateStore._cleanupBindings === 'function') {
                stateStore._cleanupBindings();
            }
        }, 30000); // Every 30 seconds
    }

    // --- Public API ---
    return {
        // DOM
        waitFor,
        on,
        onPageChange,
        batchDOM,
        // Animation
        animate,
        fadeIn,
        fadeOut,
        // State
        createStore,
        bind,
        // Components
        define,
        // Utilities
        debounce,
        throttle,
        deepClone,
        // Router
        router,
        // Performance
        measure,
        getMemoryUsage,
        // Version info
        version: '2.0.0-optimized'
    };

})();