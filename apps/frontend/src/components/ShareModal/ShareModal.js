import "./sharemodal.css";

export function createShareModal(editor, backendManager) {
  const modal = document.createElement("div");
  modal.className = "share-modal";

  const modalContent = document.createElement("div");
  modalContent.className = "share-modal-content";
  modal.appendChild(modalContent);

  modalContent.innerHTML = `
    <div class="share-modal-header">
      <h2>Share Document</h2>
      <button class="btn-close">×</button>
    </div>
    <div class="share-modal-body">
      <div class="add-people">
        <input type="email" placeholder="Add people by email" />
        <button class="btn">Share</button>
      </div>
      <div class="people-with-access">
        <h3>People with access</h3>
        <div class="user-list"></div>
      </div>
    </div>
    <div class="share-modal-footer">
      <button class="btn btn-done">Done</button>
    </div>
  `;

  const closeButton = modalContent.querySelector(".btn-close");
  const doneButton = modalContent.querySelector(".btn-done");
  const userList = modalContent.querySelector(".user-list");
  const emailInput = modalContent.querySelector(".add-people input");
  const shareButton = modalContent.querySelector(".add-people button");

  function closeModal() {
    modal.remove();
  }

  closeButton.addEventListener("click", closeModal);
  doneButton.addEventListener("click", closeModal);

  async function renderUsers() {
    const documentId = editor.documentId.replace("cloud-", "");
    const users = await backendManager.getCollaborators(documentId);
    if (editor.collab) {
      editor.collab.updateUserMap(users);
    }
    userList.innerHTML = "";
    users.forEach((user) => {
      const userItem = document.createElement("div");
      userItem.className = "user-item";
      userItem.innerHTML = `
        <div class="user-info">
          <span class="user-email">${user.email}</span>
          <span class="user-role">(${user.role})</span>
        </div>
        ${user.role !== "owner" ? `<button class="btn-remove" data-user-id="${user.id}">Remove</button>` : ""}
      `;
      userList.appendChild(userItem);
    });
  }

  shareButton.addEventListener("click", async () => {
    const email = emailInput.value;
    if (email) {
      try {
        const documentId = editor.documentId.replace("cloud-", "");
        await backendManager.addCollaborator(documentId, email);
        emailInput.value = "";
        renderUsers();
      } catch (error) {
        alert(error.message);
      }
    }
  });

  userList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-remove")) {
      const userId = e.target.dataset.userId;
      const documentId = editor.documentId.replace("cloud-", "");
      if (confirm("Are you sure you want to remove this collaborator?")) {
        await backendManager.removeCollaborator(documentId, userId);
        renderUsers();
      }
    }
  });

  renderUsers();

  return modal;
}
