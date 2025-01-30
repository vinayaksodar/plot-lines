export function heightOfElementWithMargin(element) {
  if (element && element.nodeType === 1) {
    // Check if it's an element node
    const styles = window.getComputedStyle(element);
    const marginTop = parseFloat(styles.marginTop);
    const marginBottom = parseFloat(styles.marginBottom);
    return element.offsetHeight + marginTop + marginBottom;
  } else {
    console.error("Invalid element passed:", element);
    return 0; // Or return a default value or handle appropriately
  }
}

export function widthOfElementWithMargin(element) {
  const styles = window.getComputedStyle(element);
  const marginLeft = parseFloat(styles.marginLeft);
  const marginRight = parseFloat(styles.marginRight);
  return element.offsetWidth + marginLeft + marginRight;
}
