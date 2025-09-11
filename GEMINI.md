# Gemini Context: Plot Lines - Screenplay Editor

This document provides an overview of the "plot-lines" project and the plan to evolve it from a generic text editor into a specialized screenplay editor.

## Project Overview

The project is a web-based text editor built with vanilla JavaScript, HTML, and CSS. It uses Vite for development and bundling. The editor is designed to be performant and extensible, with a clean and modern user interface.

### Core Architecture

The editor follows a Model-View-Controller (MVC) pattern:

*   **`EditorModel`**: Manages the editor's state, including the text content (as an array of lines), cursor position, and selection. It provides a clean API for manipulating the document.
*   **`EditorView`**: Renders the editor's content to the DOM. It features a virtual scrolling engine to handle large documents efficiently. It also manages the rendering of the cursor, text selections, and other UI elements like line numbers.
*   **`EditorController`**: Orchestrates the application, handling user input (keyboard, pointer events) and executing commands to modify the model. It uses a system of specialized handlers for different input types.

### Key Features

*   **MVC Architecture**: A clean separation of concerns, making the codebase easy to understand and extend.
*   **Virtual Scrolling**: The editor can handle very large files without performance degradation.
*   **Command Pattern with Undo/Redo**: All text modifications are encapsulated in command objects, providing a robust undo/redo system.
*   **File Management**: The editor supports creating new files, opening local files, saving to browser local storage, and exporting to disk. It also includes an auto-save feature.
*   **Component-Based UI**: The UI is built from reusable components, including a toolbar, search widget, and line numbers.
*   **Responsive Design**: The editor is usable on both desktop and mobile devices.

## Roadmap to a Screenplay Editor

The following is a plan to transform the current text editor into a feature-rich screenplay editor:

1.  **Define Screenplay Elements**: Introduce the standard screenplay elements:
    *   Scene Heading
    *   Action
    *   Character
    *   Dialogue
    *   Parenthetical
    *   Transition

2.  **Implement Element-Specific Styling**: Apply industry-standard formatting (indentation, capitalization, etc.) to each screenplay element. This will likely involve creating a new CSS file and updating the `EditorView` to apply classes to lines based on their element type.

3.  **Automatic Element Detection**: Implement logic to automatically detect and switch between element types as the user types. For example:
    *   A line starting with "INT." or "EXT." will be formatted as a Scene Heading.
    *   A line in all caps following an Action line will be a Character.
    *   The line following a Character will be Dialogue.

4.  **Manual Element Switching**: Add a UI element (e.g., a dropdown in the toolbar) that allows the user to manually change the type of the current line or selection.

5.  **Auto-completion**: To speed up the writing process, add auto-completion for:
    *   Scene intros (INT./EXT., DAY/NIGHT)
    *   Character names (based on characters already used in the script)

6.  **Toolbar and UI Updates**:
    *   Update the toolbar with icons and actions relevant to screenwriting.
    *   Add a title page editor.
    *   Display page numbers and manage page breaks according to screenplay standards. The code in the `old` folder can be a reference for this.

7.  **Export to Final Draft (FDX) and PDF**: Implement export functionality to generate industry-standard file formats.