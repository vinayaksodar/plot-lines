import "./widgetlayer.css";

export function createWidgetLayer() {
  const layer = document.createElement("div");
  layer.className = "widget-layer";
  layer.id = "widget-layer";

  const style = document.createElement("style");
  style.textContent = `
    .widget-layer .selection {
        background-color: rgba(0, 100, 255, 0.2);
        pointer-events: none;
    }
  `;
  layer.appendChild(style);

  return layer;
}
