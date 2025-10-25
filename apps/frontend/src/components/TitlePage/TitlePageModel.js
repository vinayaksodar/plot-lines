export class TitlePageModel {
  constructor(data = {}) {
    this.title = data.title || "Untitled";
    this.author = data.author || "Author Name";
    this.contact = data.contact || "Contact Info";
    this.quote = data.quote || "";
    this._listeners = {}; // Initialize listeners
  }

  getData() {
    return {
      title: this.title,
      author: this.author,
      contact: this.contact,
      quote: this.quote,
    };
  }

  on(eventName, callback) {
    if (!this._listeners[eventName]) {
      this._listeners[eventName] = [];
    }
    this._listeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this._listeners[eventName]) return;
    this._listeners[eventName] = this._listeners[eventName].filter(
      (listener) => listener !== callback,
    );
  }

  _notify(eventName, data) {
    if (this._listeners[eventName]) {
      this._listeners[eventName].forEach((listener) => listener(data));
    }
  }

  update(data) {
    const oldData = this.getData(); // Capture old data for comparison

    this.title = data.title ?? this.title;
    this.author = data.author ?? this.author;
    this.contact = data.contact ?? this.contact;
    this.quote = data.quote ?? this.quote;

    const newData = this.getData();
    // Only notify if data actually changed
    if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
      this._notify("change", newData);
    }
  }
}
