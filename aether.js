const aether = (function() {
    'use strict';

    // --- Core State for Shared Data ---
    let stateStore = null; // Singleton store instance

    // --- Module: DOM & Observation ---

    /**
     * Waits for an element to exist in the DOM.
     * @param {string} selector - The CSS selector for the element.
     * @returns {Promise<Element>} A promise that resolves with the element.
     */
    function waitFor(selector) {
        return new Promise(resolve => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            new MutationObserver((_, observer) => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            }).observe(document.body, { childList: true, subtree: true });
        });
    }

    /**
     * Efficiently delegates events to child elements.
     * @param {Element|string} parent - The parent element or its selector.
     * @param {string} eventType - The event type (e.g., 'click').
     * @param {string} childSelector - The selector for the target child elements.
     * @param {Function} callback - The function to call on event.
     */
    function on(parent, eventType, childSelector, callback) {
        const parentEl = typeof parent === 'string' ? document.querySelector(parent) : parent;
        if (!parentEl) return;
        parentEl.addEventListener(eventType, event => {
            const target = event.target.closest(childSelector);
            if (target) {
                callback(event, target);
            }
        });
    }
    
    /**
     * Observes the DOM for significant changes, useful for SPAs.
     * @param {Function} callback - A function to run when a change is detected.
     * @param {object} [options={ threshold: 10 }] - Configuration options.
     */
    function onPageChange(callback, options = { threshold: 10 }) {
        const observer = new MutationObserver(mutations => {
            let nodeCount = 0;
            for(const mutation of mutations) {
                nodeCount += mutation.addedNodes.length + mutation.removedNodes.length;
            }
            if (nodeCount > options.threshold) {
                callback();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return observer; // Return observer to allow disconnection
    }


    // --- Module: Animation ---

    /**
     * Promise-based wrapper for the Web Animations API.
     * @param {Element} element - The element to animate.
     * @param {Keyframe[]} keyframes - An array of keyframes.
     * @param {object} [options={ duration: 300 }] - Animation options.
     * @returns {Promise<Animation>} A promise that resolves when the animation finishes.
     */
    function animate(element, keyframes, options = { duration: 300 }) {
        if (!element || typeof element.animate !== 'function') {
             return Promise.reject('Animation API not supported or invalid element.');
        }
        return new Promise(resolve => {
            const animation = element.animate(keyframes, options);
            animation.onfinish = () => resolve(animation);
        });
    }

    /**
     * Fades an element in.
     * @param {Element} element - The element to animate.
     * @param {object} [options={ duration: 400 }] - Animation options.
     */
    function fadeIn(element, options = { duration: 400 }) {
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
     * Creates a simple, reactive state store.
     * @param {object} initialState - The initial state of the store.
     * @returns {object} The store instance.
     */
    function createStore(initialState) {
        let state = initialState;
        const subscribers = new Set();
        const bindings = {}; // { 'key': [{element, prop}, ...], 'user.name': [...] }

        const handler = {
            set(target, property, value) {
                const fullPath = (this.path ? this.path + '.' : '') + property;
                const success = Reflect.set(...arguments);
                if (success) {
                    notify(fullPath);
                    notifyBindings(fullPath);
                }
                return success;
            },
            get(target, property) {
                const value = target[property];
                if (typeof value === 'object' && value !== null) {
                    return new Proxy(value, { ...handler, path: (this.path ? this.path + '.' : '') + property });
                }
                return value;
            }
        };
        
        state = new Proxy(state, handler);

        function notify(changedKey) {
            subscribers.forEach(callback => callback(state, changedKey));
        }
        
        function notifyBindings(changedKey) {
             for(const key in bindings) {
                if (key.startsWith(changedKey)) {
                    bindings[key].forEach(({ element, prop }) => {
                        const value = getNested(state, key);
                        element[prop] = value;
                    });
                }
            }
        }
        
        function getNested(obj, path) {
            return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        }

        const store = {
            getState: () => state,
            setState: (newState) => {
                Object.entries(newState).forEach(([key, value]) => {
                    state[key] = value;
                });
            },
            subscribe: (callback) => {
                subscribers.add(callback);
                return () => subscribers.delete(callback); // Return an unsubscribe function
            },
            _addBinding: (key, element, prop) => {
                if (!bindings[key]) bindings[key] = [];
                bindings[key].push({ element, prop });
                // Initialize
                element[prop] = getNested(state, key);
            }
        };
        
        stateStore = store; // Set the singleton
        return store;
    }

    /**
     * Binds an element's property to a state key.
     * @param {Element|string} elementOrSelector - The element or its selector.
     * @param {string} stateKey - The dot-notation key in the state (e.g., 'user.name').
     */
    function bind(elementOrSelector, stateKey) {
        if (!stateStore) {
            console.error("Aether.js: Must create a store with aether.createStore() before using bind().");
            return;
        }
        waitFor(elementOrSelector).then(element => {
            const prop = (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA' || element.nodeName === 'SELECT') ? 'value' : 'textContent';
            stateStore._addBinding(stateKey, element, prop);
        });
    }

    // --- Module: Web Components ---

    /**
     * Simplifies the creation of a Web Component.
     * @param {string} name - The tag name of the component (e.g., 'user-card').
     * @param {object} config - Configuration object { props, connected, template, styles }.
     */
    function define(name, { props = {}, connected, template = '', styles = '' }) {
        customElements.define(name, class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
                this.shadowRoot.innerHTML = `<style>${styles}</style>${template}`;
                
                Object.keys(props).forEach(key => {
                    Object.defineProperty(this, key, {
                        get: () => this.getAttribute(key),
                        set: value => this.setAttribute(key, value)
                    });
                });
            }
            connectedCallback() {
                if (connected) connected(this);
            }
        });
    }
    
    // --- Module: Utilities ---

    /**
     * Creates a debounced function that delays invoking func.
     * @param {Function} func - The function to debounce.
     * @param {number} wait - The number of milliseconds to delay.
     * @returns {Function} The new debounced function.
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * Creates a throttled function that only invokes func at most once per every `limit` milliseconds.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The minimum time interval between invocations.
     * @returns {Function} The new throttled function.
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // --- Module: Routing ---
    
    /**
     * Creates a lightweight SPA router.
     * @returns {object} A router instance with add(), navigate(), and init().
     */
    function router() {
        const routes = [];
        let notFoundHandler = () => console.error("404 Not Found");
        
        function checkRoutes() {
            const path = window.location.pathname;
            const currentRoute = routes.find(route => {
                const match = path.match(route.regex);
                if (match) {
                    route.params = match.groups || {};
                    return true;
                }
            });
            if (currentRoute) {
                currentRoute.handler(currentRoute.params);
            } else {
                notFoundHandler();
            }
        }
        
        return {
            add: (path, handler) => {
                const regex = new RegExp(`^${path.replace(/:\w+/g, '(?<$&>\\w+)').replace(/:/g, '')}$`);
                routes.push({ regex, handler });
            },
            setNotFound: (handler) => notFoundHandler = handler,
            navigate: (path) => {
                window.history.pushState({}, '', path);
                checkRoutes();
            },
            init: () => {
                window.addEventListener('popstate', checkRoutes);
                document.addEventListener('click', e => {
                    const link = e.target.closest('a[data-aether-link]');
                    if (link) {
                        e.preventDefault();
                        const path = link.getAttribute('href');
                        window.history.pushState({}, '', path);
                        checkRoutes();
                    }
                });
                checkRoutes();
            }
        };
    }


    // --- Public API ---
    return {
        // DOM
        waitFor,
        on,
        onPageChange,
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
        // Router
        router
    };

})();```

### **How to Use Aether.js: A Practical Example**

This example demonstrates how several modules can work together.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Aether.js Demo</title>
    <style>
        body { font-family: sans-serif; padding: 2em; }
        nav a { margin-right: 1em; }
        #app { margin-top: 1em; padding: 1em; border: 1px solid #ccc; }
        user-card { display: block; border: 1px solid #eee; padding: 1em; margin-top: 1em; }
    </style>
</head>
<body>

    <nav>
        <a href="/" data-aether-link>Home</a>
        <a href="/profile/alice" data-aether-link>Profile</a>
    </nav>
    
    <h1>Welcome, <span id="username-display"></span>!</h1>

    <div id="app"></div>
    
    <script src="aether.js"></script>
    <script>
        // --- 1. State Management ---
        const store = aether.createStore({
            user: { name: 'Guest' },
            currentPage: 'home'
        });

        // Bind the username display to the store
        aether.bind('#username-display', 'user.name');

        // --- 2. Web Component ---
        aether.define('user-card', {
            props: { name: '', bio: '' },
            styles: `h3 { color: steelblue; }`,
            template: `
                <h3></h3>
                <p></p>
            `,
            connected(element) {
                element.shadowRoot.querySelector('h3').textContent = element.getAttribute('name');
                element.shadowRoot.querySelector('p').textContent = `Bio: ${element.getAttribute('bio')}`;
            }
        });

        // --- 3. Routing ---
        const appContainer = document.getElementById('app');
        const appRouter = aether.router();

        appRouter.add('/', () => {
            appContainer.innerHTML = '<h2>Home Content</h2><p>This is the home page.</p>';
            aether.fadeIn(appContainer);
            store.setState({ currentPage: 'home' });
        });
        
        appRouter.add('/profile/:username', (params) => {
            appContainer.innerHTML = `<user-card name="${params.username}" bio="A dynamic user of Aether.js"></user-card>`;
            aether.fadeIn(appContainer);
            store.setState({ currentPage: 'profile' });
            // Simulate a data fetch and update the store
            setTimeout(() => store.setState({ user: { name: params.username } }), 500);
        });
        
        appRouter.setNotFound(() => {
            appContainer.innerHTML = '<h2>Page Not Found</h2>';
        });
        
        // --- 4. Initialize Router ---
        appRouter.init();

    </script>
</body>
</html>
