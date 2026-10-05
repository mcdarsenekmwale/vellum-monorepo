class EventEmitter2 {
  constructor() { this.listeners = {}; }
  on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
  emit(event, ...args) { (this.listeners[event] || []).forEach(fn => fn(...args)); }
  removeAllListeners() { this.listeners = {}; }
}
function OnEvent(event) { return function() {}; }
const EventEmitterModule = { forRoot: () => ({}) };
module.exports = { EventEmitter2, OnEvent, EventEmitterModule };
