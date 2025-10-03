class AuthService {
  constructor() {
    this.currentUser = null;
    this.reauthPromise = null;
    try {
      this.currentUser = JSON.parse(localStorage.getItem("currentUser"));
    } catch (e) {
      this.currentUser = null;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  login(user) {
    this.currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem("currentUser");
  }

  reauthenticate() {
    if (!this.reauthPromise) {
      this.reauthPromise = this.showLoginModal().finally(() => {
        this.reauthPromise = null;
      });
    }
    return this.reauthPromise;
  }

  showLoginModal() {
    return new Promise((resolve, reject) => {
      if (document.querySelector(".auth-modal"))
        return reject(new Error("Modal already open"));

      const modal = document.createElement("div");
      modal.className = "auth-modal";
      modal.innerHTML = `
                <div class="auth-content">
                    <h3>Login or Signup</h3>
                    <div class="auth-form">
                        <input type="text" id="auth-email" placeholder="email" />
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
        const email = modal.querySelector("#auth-email").value;
        const password = modal.querySelector("#auth-password").value;
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (response.ok) {
          const { data } = await response.json();
          this.login(data);
          cleanup();
          resolve(data);
        } else {
          const { error } = await response.json();
          alert(`Login failed: ${error}`);
        }
      };

      const handleSignup = async () => {
        const email = modal.querySelector("#auth-email").value;
        const password = modal.querySelector("#auth-password").value;
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (response.ok) {
          alert("Signup successful! Please login.");
        } else {
          const { error } = await response.json();
          alert(`Signup failed: ${error}`);
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
