# Gemini Context: Plot Lines - Screenplay Editor

This document provides an overview of the "plot-lines" project.

## Project Overview

The project is a web-based screenplay editor built with vanilla JavaScript, HTML, and CSS. It supports both local-only documents and real-time collaborative cloud documents for premium, authenticated users. It is a monorepo managed with npm workspaces and Turborepo.

The goal is to create a feature-rich screenplay editor that provides a seamless writing experience for screenwriters, whether working alone or with a team.

### Core Architecture

The editor follows a Model-View-Controller (MVC) pattern, with a dynamic plugin system for extensibility.

- **`EditorModel`**: Manages the editor's state, including the screenplay content (as an array of lines with segments for rich text) and the Title Page data. It provides a clean API for manipulating the document.
- **`EditorView`**: Renders the editor's content to the DOM. It features a virtual scrolling engine to handle large documents efficiently.
- **`EditorController`**: Orchestrates the application, handling user input (keyboard, pointer events) and executing commands to modify the model.
- **`PersistenceManager`**: The central hub for persistence. It dynamically manages the collaboration plugin and routes save/load operations to the correct manager (`FileManager` for local, `BackendManager` for cloud) based on the document type.
- **`CollabPlugin`**: A dynamically-loaded plugin that manages real-time collaboration. It communicates with the backend via WebSockets, sending and receiving Operational Transformation (OT) commands to keep all clients in sync.

### Key Features

- **Dynamic Real-Time Collaboration**: Collaboration is enabled on-demand for authenticated users on specific cloud-based documents. It uses an Operational Transformation (OT) backend to synchronize changes between multiple users in real-time. User IDs are stable and tied to user IDs.
- **Hybrid Persistence Model**: Seamlessly supports two types of documents:
  - **Local Documents**: Saved directly to the browser's `localStorage`. The full rich-text screenplay structure and title page data are preserved using JSON.
  - **Cloud Documents**: Saved to a central backend, enabling collaboration and access from anywhere.
- **Integrated Authentication**: A login/signup flow is integrated directly into the file manager, allowing users to access their cloud documents. The UI clearly distinguishes between local and cloud files.
- **Command Pattern with Undo/Redo**: All text modifications are encapsulated in command objects (`InsertCharCommand`, `DeleteCharCommand`, etc.), providing a robust undo/redo system managed by the `UndoManager`.
- **Rich Text & Title Page Persistence**: The full data model, including screenplay structure, rich text formatting, and title page information, is correctly saved and loaded for both local and cloud documents.
- **Monorepo Architecture**: The project is structured as a monorepo using Turborepo, allowing for scalable management of different packages and applications.
- **Virtual Scrolling**: The editor can handle very large files without performance degradation by only rendering the visible lines.
- **Fountain Support**: The editor can parse and export files in the `.fountain` format.

## File Descriptions

- `turbo.json`: The configuration file for Turborepo.
- `package.json`: Defines the project dependencies and scripts for the monorepo.
- `apps/frontend/src/main.js`: Initializes the core editor components and UI. Does not initialize collaboration.
- `apps/frontend/src/services/PersistenceManager.js`: The primary orchestrator for persistence. It dynamically loads/unloads the `CollabPlugin` and routes save/load requests to either `FileManager` or `BackendManager`.
- `apps/frontend/src/services/FileManager.js`: Handles saving and loading documents to the browser's `localStorage`. It correctly serializes the rich text model to JSON.
- `apps/frontend/src/services/BackendManager.js`: Handles communication with the backend for cloud documents and user authentication.
- `apps/frontend/src/services/Auth.js`: Manages user authentication state and provides the login UI.
- `packages/editor/src/core/Editor.js`: The main editor class. Now includes methods (`destroyPlugin`) to manage the plugin lifecycle.
- `packages/editor/src/core/EditorModel.js`: The data model for the editor, holding the screenplay lines and title page data.
- `packages/editor/src/core/plugins/CollabPlugin.js`: Manages the WebSocket connection and all real-time collaboration logic. It is created and destroyed on-demand by the `PersistenceManager`.
- `packages/editor/src/core/collab.js`: Contains the core Operational Transformation (OT) logic for rebasing and transforming commands.
- `GEMINI.md`: This file, containing an overview of the project for the Gemini agent.

### Backend Architecture

The backend is a Node.js application built with the Express framework, providing a RESTful API for managing documents, users, and authentication. It uses a SQLite database for persistence and `ws` for real-time collaboration via WebSockets.

- **Database**: The backend uses SQLite for its database, which is stored in the `main.db` file. The database schema includes tables for `documents`, `users`, `document_users`, `snapshots`, and `ot_steps` to manage document content, user data, collaborators, and operational transformation steps for collaboration.
- **API Routes**: The backend exposes a set of RESTful API endpoints for various functionalities:
  - `POST /api/signup`: Creates a new user account.
  - `POST /api/login`: Authenticates a user and returns their data.
  - `GET /api/documents/:id`: Retrieves a specific document by its ID.
  - `POST /api/documents`: Creates a new document, with limitations for free users.
  - `DELETE /api/documents/:id`: Deletes a document.
  - `POST /api/documents/:id/snapshots`: Creates a new snapshot of a document.
  - `GET /api/documents/:id/steps`: Retrieves operational transformation steps for a document since a specified version.
  - `GET /api/users/:userId/documents`: Fetches all documents belonging to a specific user.
  - `POST /api/documents/:id/collaborators`: Adds a collaborator to a document.
  - `DELETE /api/documents/:id/collaborators/:userId`: Removes a collaborator from a document.
  - `GET /api/documents/:id/collaborators`: Retrieves all collaborators for a document.
- **WebSockets**: The backend uses the `ws` library to provide real-time collaboration features. When a client sends a message containing the `documentId`, `version`, `steps`, and `userID`, the backend validates the information, saves the new operational transformation steps to the database, and broadcasts the updates to all connected clients.

## File Descriptions

- `turbo.json`: The configuration file for Turborepo.
- `package.json`: Defines the project dependencies and scripts for the monorepo.
- `apps/frontend/src/main.js`: Initializes the core editor components and UI. Does not initialize collaboration.
- `apps/backend/src/server.js`: The main entry point for the backend application. It sets up the Express server and initializes the WebSocket server for real-time collaboration.
- `apps/backend/src/app.js`: This file configures the Express application, including middleware for CORS and JSON parsing, and sets up the API routes.
- `apps/backend/src/database.js`: Initializes the SQLite database and sets up the schema, including tables for documents, users, and collaboration steps.
- `apps/backend/src/routes/`: This directory contains the route handlers for the Express application, with separate files for authentication, documents, and users.
- `apps/backend/src/websockets/collaboration.js`: This file contains the logic for handling real-time collaboration via WebSockets, including processing and broadcasting operational transformation steps.
- `apps/frontend/src/services/PersistenceManager.js`: The primary orchestrator for persistence. It dynamically loads/unloads the `CollabPlugin` and routes save/load requests to either `FileManager` or `BackendManager`.
- `apps/frontend/src/services/FileManager.js`: Handles saving and loading documents to the browser's `localStorage`. It correctly serializes the rich text model to JSON.
- `apps/frontend/src/services/BackendManager.js`: Handles communication with the backend for cloud documents and user authentication.
- `apps/frontend/src/services/Auth.js`: Manages user authentication state and provides the login UI.
- `packages/editor/src/core/Editor.js`: The main editor class. Now includes methods (`destroyPlugin`) to manage the plugin lifecycle.
- `packages/editor/src/core/EditorModel.js`: The data model for the editor, holding the screenplay lines and title page data.
- `packages/editor/src/core/plugins/CollabPlugin.js`: Manages the WebSocket connection and all real-time collaboration logic. It is created and destroyed on-demand by the `PersistenceManager`.
- `packages/editor/src/core/collab.js`: Contains the core Operational Transformation (OT) logic for rebasing and transforming commands.
- `GEMINI.md`: This file, containing an overview of the project for the Gemini agent.

It is assumed that `npm run lint` and `npm run format` have been run before any changes.
