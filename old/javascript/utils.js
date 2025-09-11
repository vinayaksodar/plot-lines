function heightOfElementWithMargin(element) {
  if (element && element.nodeType === 1) {
    // console.log("Element:", element);
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

function widthOfElementWithMargin(element) {
  const styles = window.getComputedStyle(element);
  const marginLeft = parseFloat(styles.marginLeft);
  const marginRight = parseFloat(styles.marginRight);
  return element.offsetWidth + marginLeft + marginRight;
}

function contentHeightOfElement(element) {
  const styles = window.getComputedStyle(element);
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const paddingBottom = parseFloat(styles.paddingBottom) || 0;

  const usableHeight = element.clientHeight - (paddingTop + paddingBottom);

  return usableHeight;
}

export {
  heightOfElementWithMargin,
  widthOfElementWithMargin,
  contentHeightOfElement,
};
