# Plot Lines - A Screenplay Editor

Plot Lines is a web-based, feature-rich text editor designed specifically for screenwriters. It provides a clean, distraction-free writing environment with essential tools to format and manage screenplays according to industry standards.

This project is a monorepo built with vanilla JavaScript, HTML, and CSS, using Vite for a fast development experience. It's designed to be lightweight, performant, and easily extensible.

## Features

- **Screenplay Formatting:** Automatic formatting for standard screenplay elements like Scene Headings, Action, Characters, Dialogue, Parentheticals, and Transitions.
- **Fountain Support**: Import and export screenplays in the popular `.fountain` format.
- **Rich Text Editing:** Supports **bold**, _italic_, and _underline_ inline styles.
- **Virtual Scrolling:** The editor can handle very large scripts with excellent performance by only rendering the visible portion of the document.
- **File Management:**
  - Create new files, open `.fountain` files.
  - Save your work to the browser's local storage.
  - Export scripts as `.fountain` files.
  - A file manager to browse and load previously saved work.
- **Undo/Redo:** Robust undo and redo functionality for all text and formatting changes.
- **Search:** A built-in search widget to quickly find text within your script.
- **Title Page Editor:** A dedicated editor for your screenplay's title page.
- **Responsive Design:** A clean and responsive UI that works on both desktop and mobile devices.

## Tech Stack

- **Monorepo:** npm workspaces with Turborepo
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Build Tool:** [Vite](https://vitejs.dev/)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js and npm (or a compatible package manager).

### Installation & Running

1.  Clone the repo
    ```sh
    git clone https://github.com/vinayaksodar/plot-lines.git
    ```
2.  Install NPM packages from the root of the monorepo
    ```sh
    npm install
    ```
3.  Start the development server
    ```sh
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

### Building for Production

To create a production build of all apps and packages in the monorepo:

```sh
npm run build
```

The bundled files for the frontend app will be in the `apps/frontend/dist/` directory.
