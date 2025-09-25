import './titlepage.css';
import { TitlePageModel } from './TitlePageModel.js';

function createTitlePageView(model) {
  const container = document.createElement('div');
  container.className = 'title-page-container hidden';
  container.id = 'title-page';

  const content = document.createElement('div');
  content.className = 'title-page-content';
  container.appendChild(content);

  function render() {
    content.innerHTML = `
      <div class="title-main">
        <h1 contenteditable="true">${model.title}</h1>
        <h2>by</h2>
        <h3 contenteditable="true">${model.author}</h3>
      </div>
      <div class="quote" contenteditable="true">
        <p>${model.quote.replace(/\n/g, '<br>')}</p>
      </div>
      <div class="contact-info" contenteditable="true">
        <p>${model.contact.replace(/\n/g, '<br>')}</p>
      </div>
    `;

    content.querySelector('h1').addEventListener('input', (e) => {
      model.update({ title: e.target.textContent });
    });

    content.querySelector('h3').addEventListener('input', (e) => {
      model.update({ author: e.target.textContent });
    });

    content.querySelector('.quote').addEventListener('input', (e) => {
      model.update({ quote: e.target.innerText });
    });

    content.querySelector('.contact-info').addEventListener('input', (e) => {
      model.update({ contact: e.target.innerText });
    });
  }

  function show() {
    container.classList.remove('hidden');
  }

  function hide() {
    container.classList.add('hidden');
  }

  render();

  return { element: container, render, show, hide };
}

export class TitlePage {
  constructor() {
    this.model = new TitlePageModel();
    this.view = createTitlePageView(this.model);
  }

  show() {
    this.view.show();
  }

  hide() {
    this.view.hide();
  }

  render() {
    this.view.render();
  }

  get element() {
    return this.view.element;
  }
}
