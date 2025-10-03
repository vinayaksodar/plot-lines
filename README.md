# Plot Lines - A Collaborative Screenplay Editor

Plot Lines is a modern, web-based editor designed for screenwriters. It provides a clean, distraction-free writing environment with essential tools to format and manage screenplays. It supports both offline, local-only editing and powerful **real-time collaboration** for teams.

This project is a monorepo built with vanilla JavaScript, HTML, and CSS, using Vite for a fast development experience. It's designed to be lightweight, performant, and easily extensible.

## Features

- **Real-Time Collaboration:** For cloud-based documents, you can write with your team in real-time. Changes are synchronized instantly between all collaborators using an Operational Transformation (OT) engine.
- **Hybrid Storage Model:**
  - **Cloud Storage:** Log in to save your screenplays to the cloud, enabling collaboration and access from any device.
  - **Local Storage:** Work offline and save files directly to your browser's local storage. The editor preserves all rich text formatting and screenplay structure.
- **Standard Screenplay Formatting:** Automatic formatting for Scene Headings, Action, Characters, Dialogue, Parentheticals, and Transitions.
- **Fountain Support**: Import and export screenplays in the popular `.fountain` format.
- **Rich Text Editing:** Supports **bold**, _italic_, and _underline_ inline styles.
- **Title Page Editor:** A dedicated editor for your screenplay's title page, with all data saved alongside your script.
- **Integrated File Management:** A single, clean file manager to browse, open, and delete both local and cloud documents, with an integrated login flow to access your cloud files.
- **High Performance:** The editor uses a virtual scrolling engine to handle even the largest scripts with excellent performance.
- **Undo/Redo:** Robust undo and redo functionality for all text and formatting changes.
- **Search:** A built-in search widget to quickly find text within your script.
- **Responsive Design:** A clean and responsive UI that works on both desktop and mobile devices.

## Tech Stack

- **Monorepo:** npm workspaces with Turborepo
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend:** Node.js, Express, WebSocket, SQLite
- **Collaboration:** WebSocket API with an Operational Transformation (OT) core.
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
3.  Start the development servers

    This command will start both the frontend and backend development servers concurrently.

    ```sh
    npm run dev
    ```

    - The frontend will be available at `http://localhost:5173`.
    - The backend will be running on `http://localhost:3000`.

### Building for Production

To create a production build of all apps and packages in the monorepo:

```sh
npm run build
```

The bundled files for the frontend app will be in the `apps/frontend/dist/` directory.
