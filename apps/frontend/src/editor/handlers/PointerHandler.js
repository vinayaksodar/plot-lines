export class PointerHandler {
  constructor(controller, container) {
    this.controller = controller;
    this.container = container;

    // --- Unified State ---
    this.activePointerId = null;
    this.drag = false;
    this.interactionTimeout = null;
    this.pointerDownPos = { clientX: 0, clientY: 0 };
    this.dragStartModelPos = null;

    // --- Rendering State ---
    this.pendingRenderFrame = null;
    this.pendingSelection = null;

    // --- Touch-Specific State for Long-Press ---
    this.longPressTimer = null;
    this.selectionMode = false; // true only after a long press

    // --- Tuning Knobs ---
    this.dragThreshold = 5; // px movement before a drag starts
    this.LONG_PRESS_MS = 400; // ms to hold for selection on touch
    this.TAP_MAX_MOVE = 8; // px allowed during a tap/long-press before it's considered a scroll

    this.attachEvents();
  }

  /**
   * Attaches the primary pointer event listeners to the container.
   */
  attachEvents() {
    this.container.addEventListener("pointerdown", this.onPointerDown);
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerup", this.onPointerUp);
    this.container.addEventListener("pointercancel", this.onPointerCancel);

    // Using the 'touch-action' CSS property on the container is recommended
    // to prevent default browser actions like scrolling or zooming.
    // e.g., container.style.touchAction = "none";
  }

  // ===================================================================
  //  Event Handlers
  // ===================================================================

  onPointerDown = (e) => {
    // Ignore secondary pointers (e.g., multi-touch)
    if (this.activePointerId !== null) {
      return;
    }

    // Capture the pointer to ensure we receive events even if it moves
    // outside the container. This replaces the need for global listeners.
    this.container.setPointerCapture(e.pointerId);

    this.activePointerId = e.pointerId;
    this.drag = false;
    this.selectionMode = false;
    this.pointerDownPos = { clientX: e.clientX, clientY: e.clientY };
    this.dragStartModelPos = this.controller.viewToModelPos(
      this.pointerDownPos
    );

    // Safety timeout to clean up stale interactions
    this.interactionTimeout = setTimeout(() => {
      if (this.activePointerId !== null) {
        console.warn("Interaction timed out, cleaning up.");
        this.endDragOperation({ clientX: 0, clientY: 0 });
      }
    }, 10000);

    // --- Touch-Specific Logic: Long Press for Selection ---
    if (e.pointerType === "touch") {
      this.clearLongPressTimer();
      this.longPressTimer = setTimeout(() => {
        // Only start selection if the finger hasn't moved much
        if (this.activePointerId !== null) {
          this.beginLongPressSelection();
        }
      }, this.LONG_PRESS_MS);
    }
  };

  onPointerMove = (e) => {
    // Only respond to the pointer that started the interaction
    if (e.pointerId !== this.activePointerId) {
      return;
    }

    const currentPos = { clientX: e.clientX, clientY: e.clientY };

    // --- Touch-Specific Logic: Distinguish Scroll from Tap/Long-Press ---
    if (e.pointerType === "touch" && !this.selectionMode) {
      // If the user moves their finger too much before the long-press timer
      // fires, we assume they are scrolling the page.
      if (this.dist(currentPos, this.pointerDownPos) > this.TAP_MAX_MOVE) {
        this.cancelInteraction(); // Cancel the tap/long-press
      }
      // Do not preventDefault here, allowing the browser to scroll.
      return;
    }

    // --- Unified Drag Logic (for mouse or touch-selection) ---
    if (!this.drag) {
      if (this.dist(currentPos, this.pointerDownPos) > this.dragThreshold) {
        this.drag = true;
      }
    }

    if (this.drag) {
      // Once dragging (or in touch selection), prevent default actions like text selection.
      e.preventDefault();
      this.handlePointerMove(currentPos);
    }
  };

  onPointerUp = (e) => {
    if (e.pointerId !== this.activePointerId) {
      return;
    }

    // --- Touch-Specific Logic: Handle Tap ---
    // If it was a touch event that wasn't a long-press or a scroll, treat it as a tap.
    if (e.pointerType === "touch" && !this.selectionMode) {
      this.clearLongPressTimer();
      this.controller.handleClick({ clientPos: this.pointerDownPos });
      if (this.controller.hiddenInput) this.controller.hiddenInput.focus();
      this.cancelInteraction();
      return;
    }

    // --- Unified Click/Drag-End Logic ---
    this.endDragOperation(e);
  };

  onPointerCancel = (e) => {
    if (e.pointerId !== this.activePointerId) {
      return;
    }
    // Treat a cancel event like the end of an operation.
    this.endDragOperation(e);
  };

  // ===================================================================
  //  Core Logic & State Management
  // ===================================================================

  /**
   * Handles the continuous update of the selection area during a drag.
   */
  handlePointerMove(currentPos) {
    this.pendingSelection = {
      startModelPos: this.dragStartModelPos,
      endClientPos: {
        clientX: currentPos.clientX,
        clientY: currentPos.clientY,
      },
    };
    this.scheduleRenderSelection();
  }

  /**
   * Finalizes the drag/click operation and cleans up state.
   */
  endDragOperation(e) {
    const wasDragging = this.drag;

    // If it was an interaction but not a drag, it's a click (for mouse/pen).
    // Touch taps are handled earlier in `onPointerUp`.
    if (!wasDragging && e.pointerType !== "touch") {
      this.controller.handleClick({
        clientPos: { clientX: e.clientX, clientY: e.clientY },
      });
    }

    this.cancelInteraction();

    //  Ensure hidden input gets focus again so keyboard works
    if (this.controller.hiddenInput) {
      this.controller.hiddenInput.focus();
    }
  }

  /**
   * Resets all interaction-related state. This is the primary cleanup method.
   */
  cancelInteraction() {
    if (this.activePointerId !== null) {
      // Release pointer capture if it's still active.
      // Use a try-catch as it can error if the element is removed from the DOM.
      try {
        this.container.releasePointerCapture(this.activePointerId);
      } catch (err) {}
    }

    this.clearLongPressTimer();
    clearTimeout(this.interactionTimeout);
    if (this.pendingRenderFrame) {
      cancelAnimationFrame(this.pendingRenderFrame);
    }

    this.activePointerId = null;
    this.drag = false;
    this.selectionMode = false;
    this.dragStartModelPos = null;
    this.pendingSelection = null;
    this.pendingRenderFrame = null;
    this.interactionTimeout = null;
  }

  // ===================================================================
  //  Touch-Specific Helpers
  // ===================================================================

  /**
   * Initiates selection mode after a successful long press on a touch device.
   */
  beginLongPressSelection() {
    if (this.selectionMode) return;
    this.selectionMode = true;
    this.drag = true; // Engage the shared drag logic
  }

  clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // ===================================================================
  //  Utility and Rendering
  // ===================================================================

  /**
   * Calculates the Euclidean distance between two points.
   */
  dist(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  /**
   * Schedules a selection render using requestAnimationFrame to avoid layout thrashing.
   */
  scheduleRenderSelection() {
    if (this.pendingRenderFrame) return;

    this.pendingRenderFrame = requestAnimationFrame(() => {
      this.pendingRenderFrame = null;
      if (!this.pendingSelection) return;

      const { startModelPos, endClientPos } = this.pendingSelection;
      const endModelPos = this.controller.viewToModelPos(endClientPos);

      this.controller.model.setSelection(startModelPos, endModelPos);
      this.controller.model.updateCursor(endModelPos);
      this.controller.view.render();
    });
  }

  /**
   * Cleans up all listeners and timers. Should be called when the component is destroyed.
   */
  destroy() {
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerup", this.onPointerUp);
    this.container.removeEventListener("pointercancel", this.onPointerCancel);

    this.cancelInteraction(); // A single call to the main cleanup function
  }
}
