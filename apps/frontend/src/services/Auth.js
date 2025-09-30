class AuthService {
  constructor() {
    this.currentUser = null;
    try {
      this.currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    } catch (e) {
      this.currentUser = null;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  login(user) {
    this.currentUser = user;
    sessionStorage.setItem("currentUser", JSON.stringify(user));
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem("currentUser");
  }

  showLoginModal() {
    return new Promise((resolve, reject) => {
      if (document.querySelector(".auth-modal"))
        return reject(new Error("Modal already open"));

      const modal = document.createElement("div");
      modal.className = "auth-modal";
      modal.innerHTML = `
                <div class="auth-content">
                    <h3>Login or Signup for Cloud Storage</h3>
                    <div class="auth-form">
                        <input type="text" id="auth-name" placeholder="Name" />
                        <input type="password" id="auth-password" placeholder="Password" />
                        <div class="auth-actions">
                            <button class="btn" id="auth-login">Login</button>
                            <button class="btn" id="auth-signup">Signup</button>
                            <button class="btn btn-secondary" id="auth-cancel">Cancel</button>
                        </div>
                    </div>
                </div>
            `;

      const cleanup = () => document.body.removeChild(modal);

      const handleLogin = async () => {
        const name = modal.querySelector("#auth-name").value;
        const password = modal.querySelector("#auth-password").value;
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, password }),
        });
        if (response.ok) {
          const { data } = await response.json();
          this.login(data);
          cleanup();
          resolve(data);
        } else {
          alert("Login failed");
        }
      };

      const handleSignup = async () => {
        const name = modal.querySelector("#auth-name").value;
        const password = modal.querySelector("#auth-password").value;
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, password }),
        });
        if (response.ok) {
          alert("Signup successful! Please login.");
        } else {
          alert("Signup failed");
        }
      };

      modal.querySelector("#auth-login").addEventListener("click", handleLogin);
      modal
        .querySelector("#auth-signup")
        .addEventListener("click", handleSignup);
      modal.querySelector("#auth-cancel").addEventListener("click", () => {
        cleanup();
        reject(new Error("Login cancelled"));
      });

      document.body.appendChild(modal);
    });
  }
}

export const authService = new AuthService();
