const db = window.hopebridgeSupabase;

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const message = document.getElementById("registerMessage");
        message.textContent = "Creating your account...";

        const fullName = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const role = document.getElementById("role").value;

        const { data, error } = await db.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    role: role
                }
            }
        });

        if (error) {
            message.textContent = error.message;
            return;
        }

        message.textContent = data.session
            ? "Account created successfully. You can now login."
            : "Account created. Please check your email if verification is enabled.";

        registerForm.reset();
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const message = document.getElementById("loginMessage");
        message.textContent = "Logging in...";

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const { data, error } = await db.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            message.textContent = error.message;
            return;
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single();

        if (profileError || !profile) {
            message.textContent = "Account profile could not be found.";
            await db.auth.signOut();
            return;
        }

        if (profile.role === "admin") {
            window.location.href = "admin-dashboard.html";
        } else if (profile.role === "orphanage") {
            window.location.href = "orphanage-dashboard.html";
        } else {
            window.location.href = "donor-dashboard.html";
        }
    });
}
