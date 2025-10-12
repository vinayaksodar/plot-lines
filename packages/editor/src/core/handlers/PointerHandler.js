export class PointerHandler {
  constructor(controller) {
    this.controller = controller;
    this.container = controller.view.container;

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
  }

  // ===================================================================
  //  Event Handlers
  // ===================================================================

  onPointerDown = (e) => {
    if (this.activePointerId !== null) {
      return;
    }

    this.container.setPointerCapture(e.pointerId);

    this.activePointerId = e.pointerId;
    this.drag = false;
    this.selectionMode = false;
    this.pointerDownPos = { clientX: e.clientX, clientY: e.clientY };
    this.dragStartModelPos = this.controller.view.viewToModelPos(
      this.pointerDownPos,
    );

    this.interactionTimeout = setTimeout(() => {
      if (this.activePointerId !== null) {
        console.warn("Interaction timed out, cleaning up.");
        this.endDragOperation({ clientX: 0, clientY: 0 });
      }
    }, 10000);

    if (e.pointerType === "touch") {
      this.clearLongPressTimer();
      this.longPressTimer = setTimeout(() => {
        if (this.activePointerId !== null) {
          this.beginLongPressSelection();
        }
      }, this.LONG_PRESS_MS);
    }
  };

  onPointerMove = (e) => {
    if (e.pointerId !== this.activePointerId) {
      return;
    }

    const currentPos = { clientX: e.clientX, clientY: e.clientY };

    if (e.pointerType === "touch" && !this.selectionMode) {
      if (this.dist(currentPos, this.pointerDownPos) > this.TAP_MAX_MOVE) {
        this.cancelInteraction();
      }
      return;
    }

    if (!this.drag) {
      if (this.dist(currentPos, this.pointerDownPos) > this.dragThreshold) {
        this.drag = true;
      }
    }

    if (this.drag) {
      e.preventDefault();
      this.handlePointerMove(currentPos);
    }
  };

  onPointerUp = (e) => {
    if (e.pointerId !== this.activePointerId) {
      return;
    }

    if (e.pointerType === "touch" && !this.selectionMode) {
      this.clearLongPressTimer();
      const { line, ch } = this.controller.view.viewToModelPos(
        this.pointerDownPos,
      );
      this.controller.model.clearSelection();
      this.controller.model.updateCursor({ line, ch });
      this.controller.view.render();
      this.controller.focusEditor();
      this.cancelInteraction();
      return;
    }

    this.endDragOperation(e);
  };

  onPointerCancel = (e) => {
    if (e.pointerId !== this.activePointerId) {
      return;
    }
    this.endDragOperation(e);
  };

  // ===================================================================
  //  Core Logic & State Management
  // ===================================================================

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

  endDragOperation(e) {
    const wasDragging = this.drag;

    if (!wasDragging && e.pointerType !== "touch") {
      const { line, ch } = this.controller.view.viewToModelPos({
        clientX: e.clientX,
        clientY: e.clientY,
      });
      this.controller.model.clearSelection();
      this.controller.model.updateCursor({ line, ch });
      this.controller.view.render();
    }

    this.cancelInteraction();

    this.controller.focusEditor();
  }

  cancelInteraction() {
    if (this.activePointerId !== null) {
      try {
        this.container.releasePointerCapture(this.activePointerId);
      } catch (err) {
        console.error("Failed to release pointer capture", err);
        /* empty */
      }
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

  dist(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  scheduleRenderSelection() {
    if (this.pendingRenderFrame) return;

    this.pendingRenderFrame = requestAnimationFrame(() => {
      this.pendingRenderFrame = null;
      if (!this.pendingSelection) return;

      const { startModelPos, endClientPos } = this.pendingSelection;
      const endModelPos = this.controller.view.viewToModelPos(endClientPos);

      const model = this.controller.model;
      model.setSelection(startModelPos, endModelPos);
      model.updateCursor(endModelPos);
      this.controller.view.render();
    });
  }
}
