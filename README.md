# Aether.js

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Version: 2.0.0](https://img.shields.io/badge/version-2.0.0-brightgreen.svg) ![Dependencies: 0](https://img.shields.io/badge/dependencies-0-lightgrey.svg) ![Size: ~8KB Gzipped](https://img.shields.io/badge/size-~8KB%20gzipped-orange.svg)

**Aether.js is a production-ready, zero-dependency JavaScript library for the modern web. It provides just enough structure and utility to handle common client-side tasks without the overhead of a large framework, now with enhanced performance, reliability, and developer experience.**

Think of it as the minimalist's toolkit for building fast, efficient, and maintainable websites and single-page applicationsâ€”refined for real-world use.

## Philosophy

In a world of heavyweight frameworks, Aether.js is intentionally small yet powerful. It's built on a simple premise: leverage modern browser APIs and provide clean, intuitive solutions for the 80% of tasks you do every day. No virtual DOM, no complex build tools required, no fluff. Just a single file that gives you superpowers with enterprise-grade reliability.

## What's New in v2.0

**Performance Optimized**: Batched state updates, automatic cleanup, and optimized DOM operations  
**Enhanced Reliability**: Comprehensive error handling, input validation, and graceful fallbacks  
**Advanced Features**: Middleware support, property validation, memory management, and developer tools  
**Better DX**: Method chaining, cleanup functions, performance monitoring, and helpful warnings  
**Memory Safe**: Automatic dead reference cleanup and WeakMap usage where appropriate

## Core Features

*   **Reactive State Management:** A high-performance store with batched updates and automatic cleanup
*   **DOM Utilities:** Enhanced async operations with timeout support and efficient event delegation
*   **Animation Helpers:** Web Animations API with CSS fallbacks for maximum compatibility
*   **Web Component Factory:** Enhanced components with property validation and lifecycle management
*   **Advanced SPA Routing:** Middleware support, query parsing, and hash mode compatibility
*   **Production Utilities:** Robust `debounce`/`throttle` with advanced options and performance tools
*   **Memory Management:** Built-in cleanup systems and performance monitoring for production apps

## Getting Started

Getting started is as simple as it gets. Download `aether.js` and include it in your HTML file.

```html
<script src="path/to/aether.js"></script>
```

That's it! The `aether` object is now available globally with full backwards compatibility.

---

## API Documentation

### DOM & Observation

#### `aether.waitFor(selector, timeout?)`

Asynchronously waits for an element to appear in the DOM with timeout support.

*   **`selector`** (string): The CSS selector of the element.
*   **`timeout`** (number, optional): Timeout in milliseconds (default: 5000).
*   **Returns:** `Promise<Element>` that resolves with the element when it exists.

```javascript
aether.waitFor('#dynamic-content', 10000).then(element => {
  console.log('It exists!', element);
  element.textContent = 'Content loaded.';
}).catch(error => {
  console.error('Element not found within timeout');
});
```

#### `aether.on(parent, eventType, childSelector, callback, options?)`

Efficiently delegates events with cleanup support and enhanced error handling.

*   **`parent`** (Element|string): The parent element or its selector.
*   **`eventType`** (string): The event type (e.g., `'click'`).
*   **`childSelector`** (string): The selector for the target child elements.
*   **`callback`** (Function): The function to execute, receiving `event` and `target` as arguments.
*   **`options`** (object, optional): Event listener options.
*   **Returns:** `Function` - Cleanup function to remove the event listener.

```javascript
// Handles clicks on any .delete-btn inside the #user-list container
const cleanup = aether.on('#user-list', 'click', '.delete-btn', (event, target) => {
  const userId = target.dataset.userId;
  console.log('Deleting user:', userId);
  target.closest('li').remove();
});

// Later, remove the event listener
cleanup();
```

#### `aether.onPageChange(callback, options?)`

Enhanced DOM change observer with debouncing for better performance.

*   **`options`** (object): `{ threshold: 10, debounceMs: 100 }`
*   **Returns:** `{ disconnect, observer }` - Object with cleanup method

```javascript
const { disconnect } = aether.onPageChange(() => {
  console.log('Significant DOM changes detected');
}, { threshold: 5, debounceMs: 200 });

// Later, stop observing
disconnect();
```

#### `aether.batchDOM(operations)` ðŸ†•

Batch DOM operations to minimize reflows and repaints.

```javascript
await aether.batchDOM(() => {
  element1.style.width = '100px';
  element2.style.height = '200px';
  element3.classList.add('active');
});
```

### State Management

#### `aether.createStore(initialState)`

Creates a high-performance reactive state store with batched updates.

*   **`initialState`** (object): The initial state of your application.
*   **Returns:** Enhanced store object with performance optimizations.

```javascript
const store = aether.createStore({
  user: { name: 'Guest', loggedIn: false },
  counter: 0
});
```

#### `store.setState(newState, options?)` 

Enhanced setState with merge options and batched updates.

*   **`options`** (object): `{ merge: true }` - Set to false to replace entire state

```javascript
store.setState({ user: { name: 'Alice', loggedIn: true } });

// Replace entire state instead of merging
store.setState({ counter: 0 }, { merge: false });
```

#### `store.subscribe(callback)`

Register change listeners with enhanced error handling.

*   **Returns:** An `unsubscribe` function.

```javascript
const unsubscribe = store.subscribe((newState, changedKeys) => {
  console.log('State changed! Keys:', changedKeys);
  console.log('New counter value:', newState.counter);
});

store.setState({ counter: 1 }); // The callback will fire
unsubscribe(); // Stop listening to changes
```

#### `aether.bind(elementOrSelector, stateKey, options?)` 

Enhanced data binding with transform support and better error handling.

*   **`options`** (object): `{ prop, transform }` - Custom property and transform function
*   **Returns:** `Promise<Function>` - Promise that resolves to cleanup function

```html
<p>Welcome, <span id="username"></span>!</p>
<p>Items: <span id="item-count"></span></p>
```

```javascript
// Basic binding
await aether.bind('#username', 'user.name');

// Custom property and transform
await aether.bind('#item-count', 'items', {
  prop: 'textContent',
  transform: (items) => items?.length || 0
});

store.setState({ 
  user: { name: 'Bob' },
  items: ['item1', 'item2', 'item3']
}); // Updates both elements
```

### Animation

#### `aether.animate(element, keyframes, options?)` 

Enhanced Web Animations API with CSS fallback for unsupported browsers.

*   **Returns:** `Promise<Animation>` with error handling and fallback support

#### `aether.fadeIn(element, options?)` / `aether.fadeOut(element, options?)`

Improved fade animations with better browser support.

```javascript
const modal = document.querySelector('#my-modal');
aether.fadeIn(modal, { duration: 500 }).then(() => {
  console.log('Modal is visible with fallback support.');
}).catch(error => {
  console.error('Animation failed:', error);
});
```

### Web Components

#### `aether.define(name, config)`

Enhanced Web Component creation with property validation and lifecycle management.

*   **`config`** (object): Enhanced configuration options

```javascript
aether.define('user-card', {
  props: { 
    name: { type: String, validator: (v) => v.length > 0 },
    age: { type: Number },
    active: Boolean 
  },
  methods: {
    toggleActive() {
      this.active = !this.active;
    }
  },
  styles: `
    :host { display: block; padding: 1rem; }
    h3 { color: steelblue; }
    .inactive { opacity: 0.5; }
  `,
  template: `
    <h3></h3>
    <p>Age: <span class="age"></span></p>
    <button onclick="this.getRootNode().host.toggleActive()">Toggle</button>
  `,
  connected() {
    this.shadowRoot.querySelector('h3').textContent = this.name;
    this.shadowRoot.querySelector('.age').textContent = this.age;
  },
  disconnected() {
    // Cleanup logic
  },
  attributeChanged(name, oldValue, newValue) {
    if (name === 'active') {
      this.classList.toggle('inactive', !this.active);
    }
  }
});
```

```html
<user-card name="Charlie" age="25" active="true"></user-card>
```

### Advanced SPA Routing

#### `aether.router(options?)`

Enhanced router with middleware support, query parsing, and advanced features.

*   **`options`** (object): `{ hashMode, baseUrl, caseSensitive }`
*   **Returns:** Enhanced router instance with method chaining

```javascript
const router = aether.router({ 
  baseUrl: '/app',
  caseSensitive: false 
});

// Middleware for authentication
router.use(async (context) => {
  if (context.path.startsWith('/admin') && !isAuthenticated()) {
    router.navigate('/login');
    return false; // Stop route execution
  }
  return true;
});

// Add routes with chaining
router
  .add('/', (context) => {
    app.innerHTML = '<h1>Home</h1>';
    console.log('Query params:', context.query);
  })
  .add('/users/:id', async (context) => {
    const { id } = context.params;
    app.innerHTML = `<h1>User Profile: ${id}</h1>`;
    
    // Access query parameters
    const tab = context.query.tab || 'profile';
    console.log('Active tab:', tab);
  })
  .setNotFound((context) => {
    app.innerHTML = `<h2>404 - Page Not Found: ${context.path}</h2>`;
  })
  .init(); // Method chaining supported

// Navigate programmatically
router.navigate('/users/123?tab=settings');

// Get current route info
const current = router.getCurrentRoute();

// Clean up when needed
router.destroy();
```

### Enhanced Utilities

#### `aether.debounce(func, wait, immediate?)` 

Enhanced debounce with immediate execution option and cancel method.

*   **`immediate`** (boolean): Trigger on leading edge instead of trailing
*   **Returns:** Debounced function with `cancel()` method

```javascript
const debouncedSearch = aether.debounce(handleSearch, 300, true);

// Cancel pending execution
debouncedSearch.cancel();
```

#### `aether.throttle(func, limit, options?)`

Advanced throttle with leading/trailing options.

*   **`options`** (object): `{ leading: true, trailing: true }`

```javascript
const throttledScroll = aether.throttle(handleScroll, 100, {
  leading: true,
  trailing: false
});
```

#### `aether.deepClone(obj)` ðŸ†•

Utility for deep cloning objects.

```javascript
const cloned = aether.deepClone(originalObject);
```

### Performance & Debugging Tools ðŸ†•

#### `aether.measure(name, fn)`

Performance measurement tool for development.

```javascript
const result = aether.measure('Heavy Operation', () => {
  // Some expensive operation
  return processLargeDataset();
});
// Logs: [Aether.js] Heavy Operation: 45.32ms
```

#### `aether.getMemoryUsage()`

Memory usage monitoring (Chrome/Edge only).

```javascript
const memory = aether.getMemoryUsage();
console.log(`Memory used: ${memory.used}MB of ${memory.total}MB`);
```

---

## Migration from v1.x

Aether.js v2.0 is **100% backwards compatible** with v1.x. All existing code will continue to work without changes, but you can gradually adopt the new features:

- Event handlers now return cleanup functions (optional to use)
- State subscriptions receive an array of changed keys instead of a single key
- New optional parameters provide enhanced functionality
- Performance improvements are automatic

---

## Browser Support

- **Modern Browsers**: Full feature support including Web Animations API
- **Legacy Browsers**: Graceful fallbacks for animations and enhanced error handling
- **Mobile**: Optimized for mobile performance and touch interactions

---

## Contributing

Aether.js is proudly minimalist yet production-ready. Contributions are welcome! If you have an idea for a feature that aligns with the core philosophy (lightweight, zero-dependency, high-impact), please open an issue to discuss it.

### Development Principles

1. **Zero Dependencies**: No external libraries, ever
2. **Performance First**: Every feature must be optimized for production use
3. **Backwards Compatible**: New versions should not break existing code
4. **Browser Agnostic**: Support modern browsers with graceful fallbacks
5. **Memory Efficient**: Built-in cleanup and memory management

## License

Aether.js is open-source software licensed under the [MIT License](LICENSE).