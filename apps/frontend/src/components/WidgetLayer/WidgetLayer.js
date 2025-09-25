import "./widgetlayer.css";

export function createWidgetLayer() {
  const layer = document.createElement("div");
  layer.className = "widget-layer";
  layer.id = "widget-layer";
  return layer;
}
