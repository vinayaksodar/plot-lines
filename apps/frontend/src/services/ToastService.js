const ToastService = {
  showToast(message, type = "success", options = {}) {
    const { isPersistent = false } = options;
    const toast = document.createElement("div");
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    if (!isPersistent) {
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
          if (toast.parentElement) {
            document.body.removeChild(toast);
          }
        }, 500);
      }, 3000);
    }

    return toast;
  },

  hideToast(toastElement) {
    if (toastElement && toastElement.parentElement) {
      toastElement.classList.remove("show");
      setTimeout(() => {
        if (toastElement.parentElement) {
          document.body.removeChild(toastElement);
        }
      }, 500);
    }
  },
};

export default ToastService;
