# Gemini Context: Plot Lines - Screenplay Editor

This document provides an overview of the "plot-lines" project.

## Project Overview

The project is a web-based screenplay editor built with vanilla JavaScript, HTML, and CSS. It is a monorepo managed with npm workspaces and Turborepo. The main frontend application is located in `apps/frontend` and uses Vite for development and bundling. The editor is designed to be performant and extensible, with a clean and modern user interface.

The goal is to create a feature-rich screenplay editor that provides a seamless writing experience for screenwriters.

### Core Architecture

The editor follows a Model-View-Controller (MVC) pattern:

- **`EditorModel`**: Manages the editor's state, including the text content (as an array of lines with segments for rich text), cursor position, and selection. It provides a clean API for manipulating the document.
- **`EditorView`**: Renders the editor's content to the DOM. It features a virtual scrolling engine to handle large documents efficiently. It also manages the rendering of the cursor, text selections, and other UI elements like line numbers and page breaks.
- **`EditorController`**: Orchestrates the application, handling user input (keyboard, pointer events) and executing commands to modify the model. It uses a system of specialized handlers for different input types:
  - `KeyboardHandler`: Manages all keyboard inputs, including character insertion, deletion, and navigation.
  - `PointerHandler`: Manages mouse and touch inputs for cursor placement and text selection.
  - `ToolbarHandler`: Manages interactions with the toolbar buttons.
  - `SearchHandler`: Manages the search functionality.
  - `FileHandler`: Manages file operations like new, open, save, and export.

### Key Features

- **Monorepo Architecture**: The project is structured as a monorepo using Turborepo, allowing for scalable management of different packages and applications.
- **MVC Architecture**: A clean separation of concerns, making the codebase easy to understand and extend.
- **Virtual Scrolling**: The editor can handle very large files without performance degradation by only rendering the visible lines.
- **Command Pattern with Undo/Redo**: All text modifications are encapsulated in command objects (`InsertCharCommand`, `DeleteCharCommand`, etc.), providing a robust undo/redo system managed by the `UndoManager`.
- **File Management**: The editor supports creating new files, opening local files, saving to browser local storage, and exporting to disk. It also includes an auto-save feature.
- **Component-Based UI**: The UI is built from reusable components, including a `Toolbar`, `SearchWidget`, and `LineNumbers`.
- **Rich Text Editing**: Supports bold, italic, and underline styles within lines.
- **Screenplay Element Formatting**: Supports standard screenplay elements like Scene Heading, Action, Character, Dialogue, Parenthetical, and Transition, with specific styling for each.
- **Fountain Support**: The editor can parse and export files in the `.fountain` format.
- **Title Page Editor**: A dedicated component for creating and editing a screenplay's title page.
- **Responsive Design**: The editor is usable on both desktop and mobile devices.

## File Descriptions

- `turbo.json`: The configuration file for Turborepo.
- `package.json`: Defines the project dependencies and scripts for the monorepo.
- `apps/frontend/index.html`: The main entry point of the application.
- `apps/frontend/src/main.js`: Initializes the editor and its components.
- `apps/frontend/src/style.css`: Global styles for the application.
- `apps/frontend/src/editor/EditorModel.js`: The data model for the editor.
- `apps/frontend/src/editor/EditorView.js`: The view layer, responsible for rendering the editor.
- `apps/frontend/src/editor/EditorController.js`: The controller that handles user input and orchestrates the application.
- `apps/frontend/src/editor/commands.js`: Defines the command objects for text manipulation.
- `apps/frontend/src/editor/undoManager.js`: Manages the undo/redo history.
- `apps/frontend/src/editor/handlers/`: Contains the input handlers for keyboard, pointer, toolbar, search, and file operations.
- `apps/frontend/src/components/`: Contains the UI components like the toolbar, search widget, and line numbers.
- `apps/frontend/src/services/FountainParser.js`: A parser for the Fountain screenplay format.
- `apps/frontend/vite.config.js`: The configuration file for the Vite development server.
- `GEMINI.md`: This file, containing an overview of the project for the Gemini agent.

It is assumed that `npm run lint` and `npm run format` have been run before any changes.