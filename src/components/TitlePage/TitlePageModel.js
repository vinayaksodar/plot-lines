export class TitlePageModel {
  constructor(data = {}) {
    this.title = data.title || 'Untitled';
    this.author = data.author || 'Author Name';
    this.contact = data.contact || 'Contact Info';
  }

  getData() {
    return {
      title: this.title,
      author: this.author,
      contact: this.contact,
    };
  }

  update(data) {
    this.title = data.title ?? this.title;
    this.author = data.author ?? this.author;
    this.contact = data.contact ?? this.contact;
  }
}
