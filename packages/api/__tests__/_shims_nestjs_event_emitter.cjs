class EventEmitter2 {
  constructor() { this.listeners = {}; }
  on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); return this; }
  off(event, fn) { return this.removeListener(event, fn); }
  removeListener(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }
    return this;
  }
  emit(event, ...args) { (this.listeners[event] || []).forEach(fn => fn(...args)); return true; }
  removeAllListeners() { this.listeners = {}; return this; }
}
function OnEvent(event) { return function() {}; }
class EventEmitterModule {
  static forRoot() {
    return { module: EventEmitterModule, global: true, providers: [EventEmitter2], exports: [EventEmitter2] };
  }
}
module.exports = { EventEmitter2, OnEvent, EventEmitterModule };
