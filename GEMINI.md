# Gemini Context: Plot Lines - Screenplay Editor

This document provides an overview of the "plot-lines" project.

## Project Overview

The project is a web-based screenplay editor built with vanilla JavaScript, HTML, and CSS. It supports both local-only documents and real-time collaborative cloud documents for premium, authenticated users. It is a monorepo managed with npm workspaces and Turborepo.

The goal is to create a feature-rich screenplay editor that provides a seamless writing experience for screenwriters, whether working alone or with a team.

### Core Architecture

The editor follows a Model-View-Controller (MVC) pattern, with a dynamic plugin system for extensibility.

-   **`EditorModel`**: Manages the editor's state, including the screenplay content (as an array of lines with segments for rich text) and the Title Page data. It provides a clean API for manipulating the document.
-   **`EditorView`**: Renders the editor's content to the DOM. It features a virtual scrolling engine to handle large documents efficiently.
-   **`EditorController`**: Orchestrates the application, handling user input (keyboard, pointer events) and executing commands to modify the model.
-   **`PersistenceManager`**: The central hub for persistence. It dynamically manages the collaboration plugin and routes save/load operations to the correct manager (`FileManager` for local, `BackendManager` for cloud) based on the document type.
-   **`CollabPlugin`**: A dynamically-loaded plugin that manages real-time collaboration. It communicates with the backend via WebSockets, sending and receiving Operational Transformation (OT) commands to keep all clients in sync.

### Key Features

-   **Dynamic Real-Time Collaboration**: Collaboration is enabled on-demand for authenticated users on specific cloud-based documents. It uses an Operational Transformation (OT) backend to synchronize changes between multiple users in real-time. Client IDs are stable and tied to user IDs.
-   **Hybrid Persistence Model**: Seamlessly supports two types of documents:
    -   **Local Documents**: Saved directly to the browser's `localStorage`. The full rich-text screenplay structure and title page data are preserved using JSON.
    -   **Cloud Documents**: Saved to a central backend, enabling collaboration and access from anywhere.
-   **Integrated Authentication**: A login/signup flow is integrated directly into the file manager, allowing users to access their cloud documents. The UI clearly distinguishes between local and cloud files.
-   **Command Pattern with Undo/Redo**: All text modifications are encapsulated in command objects (`InsertCharCommand`, `DeleteCharCommand`, etc.), providing a robust undo/redo system managed by the `UndoManager`.
-   **Rich Text & Title Page Persistence**: The full data model, including screenplay structure, rich text formatting, and title page information, is correctly saved and loaded for both local and cloud documents.
-   **Monorepo Architecture**: The project is structured as a monorepo using Turborepo, allowing for scalable management of different packages and applications.
-   **Virtual Scrolling**: The editor can handle very large files without performance degradation by only rendering the visible lines.
-   **Fountain Support**: The editor can parse and export files in the `.fountain` format.

## File Descriptions

-   `turbo.json`: The configuration file for Turborepo.
-   `package.json`: Defines the project dependencies and scripts for the monorepo.
-   `apps/frontend/src/main.js`: Initializes the core editor components and UI. Does not initialize collaboration.
-   `apps/frontend/src/services/PersistenceManager.js`: The primary orchestrator for persistence. It dynamically loads/unloads the `CollabPlugin` and routes save/load requests to either `FileManager` or `BackendManager`.
-   `apps/frontend/src/services/FileManager.js`: Handles saving and loading documents to the browser's `localStorage`. It correctly serializes the rich text model to JSON.
-   `apps/frontend/src/services/BackendManager.js`: Handles communication with the backend for cloud documents and user authentication.
-   `apps/frontend/src/services/Auth.js`: Manages user authentication state and provides the login UI.
-   `packages/editor/src/core/Editor.js`: The main editor class. Now includes methods (`destroyPlugin`) to manage the plugin lifecycle.
-   `packages/editor/src/core/EditorModel.js`: The data model for the editor, holding the screenplay lines and title page data.
-   `packages/editor/src/core/plugins/CollabPlugin.js`: Manages the WebSocket connection and all real-time collaboration logic. It is created and destroyed on-demand by the `PersistenceManager`.
-   `packages/editor/src/core/collab.js`: Contains the core Operational Transformation (OT) logic for rebasing and transforming commands.
-   `GEMINI.md`: This file, containing an overview of the project for the Gemini agent.

It is assumed that `npm run lint` and `npm run format` have been run before any changes.