const db = window.hopebridgeSupabase;
        let currentUser;

        function escapeHTML(value) {
            return String(value ?? "").replace(/[&<>"']/g, function(char) {
                return {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                }[char];
            });
        }

        function getStatusClass(status) {
            if (status === "approved") return "approved";
            if (status === "rejected") return "rejected";
            if (status === "completed") return "completed";
            return "";
        }

        async function checkAdmin() {
            const { data, error } = await db.auth.getUser();

            if (error || !data.user) {
                window.location.href = "login.html";
                return false;
            }

            currentUser = data.user;

            const { data: profile, error: profileError } = await db
                .from("profiles")
                .select("full_name, role")
                .eq("id", currentUser.id)
                .single();

            if (profileError || !profile || profile.role !== "admin") {
                alert("Access denied. Admin account required.");
                await db.auth.signOut();
                window.location.href = "login.html";
                return false;
            }

            document.getElementById("adminName").textContent = profile.full_name || "Admin";
            return true;
        }

        async function loadDashboard() {
            const message = document.getElementById("mainMessage");
            message.textContent = "Loading dashboard...";

            const results = await Promise.all([
                db.from("profiles").select("id").eq("role", "donor"),
                db.from("orphanages").select("*").order("created_at", { ascending: false }),
                db.from("wishlist_items").select("*").order("created_at", { ascending: false }),
                db.from("birthday_requests").select("*").order("created_at", { ascending: false })
            ]);

            const [donors, orphanages, wishlist, birthdays] = results;
            const failed = results.find(result => result.error);

            if (failed) {
                message.textContent = "Could not load dashboard data: " + failed.error.message;
                return;
            }

            document.getElementById("donorCount").textContent = donors.data.length;
            document.getElementById("orphanageCount").textContent = orphanages.data.length;
            document.getElementById("wishlistCount").textContent = wishlist.data.length;
            document.getElementById("birthdayCount").textContent = birthdays.data.length;

            showOrphanages(orphanages.data);
            showWishlist(wishlist.data);
            showBirthdays(birthdays.data);

            await loadSponsorships();
            message.textContent = "Dashboard updated successfully.";
        }

        function showOrphanages(items) {
            const list = document.getElementById("orphanageList");

            if (!items.length) {
                list.innerHTML = "<p class='empty'>No orphanages registered yet.</p>";
                return;
            }

            list.innerHTML = items.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.name)}</h3>
                    <p>Address: ${escapeHTML(item.address || "Not provided")}</p>
                    <p>${escapeHTML(item.description || "No description available")}</p>
                    <span class="status ${getStatusClass(item.status)}">${escapeHTML(item.status)}</span>
                    ${item.status === "pending" ? `
                        <div class="actions">
                            <button class="approve" data-type="orphanage" data-id="${item.id}" data-status="approved">Approve</button>
                            <button class="reject" data-type="orphanage" data-id="${item.id}" data-status="rejected">Reject</button>
                        </div>
                    ` : ""}
                </div>
            `).join("");
        }

        function showWishlist(items) {
            const list = document.getElementById("wishlistList");

            if (!items.length) {
                list.innerHTML = "<p class='empty'>No wishlist requests found.</p>";
                return;
            }

            list.innerHTML = items.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.item_name)}</h3>
                    <p>${escapeHTML(item.description || "")}</p>
                    <p>Quantity: ${item.quantity}</p>
                    <span class="status ${getStatusClass(item.status)}">${escapeHTML(item.status)}</span>
                    ${item.status === "pending" ? `
                        <div class="actions">
                            <button class="approve" data-type="wishlist" data-id="${item.id}" data-status="approved">Approve</button>
                            <button class="reject" data-type="wishlist" data-id="${item.id}" data-status="rejected">Reject</button>
                        </div>
                    ` : ""}
                </div>
            `).join("");
        }

        function showBirthdays(items) {
            const list = document.getElementById("birthdayList");

            if (!items.length) {
                list.innerHTML = "<p class='empty'>No birthday requests found.</p>";
                return;
            }

            list.innerHTML = items.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.title)}</h3>
                    <p>${escapeHTML(item.description || "")}</p>
                    <p>Date: ${escapeHTML(item.meal_date)}</p>
                    <p>Children: ${item.children_count}</p>
                    <p>Estimated cost: ₹${item.estimated_cost}</p>
                    <span class="status ${getStatusClass(item.status)}">${escapeHTML(item.status)}</span>
                    ${item.status === "pending" ? `
                        <div class="actions">
                            <button class="approve" data-type="birthday" data-id="${item.id}" data-status="approved">Approve</button>
                            <button class="reject" data-type="birthday" data-id="${item.id}" data-status="rejected">Reject</button>
                        </div>
                    ` : ""}
                </div>
            `).join("");
        }

        async function loadSponsorships() {
            const list = document.getElementById("sponsorshipList");
            list.innerHTML = "<p class='empty'>Loading sponsorship requests...</p>";

            const { data: items, error } = await db
                .from("sponsorships")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                list.innerHTML = "<p class='empty'>Could not load sponsorships: " + escapeHTML(error.message) + "</p>";
                document.getElementById("sponsorshipCount").textContent = "—";
                return;
            }

            const pendingCount = items.filter(item => item.status === "pending").length;
            document.getElementById("sponsorshipCount").textContent = pendingCount;

            if (!items.length) {
                list.innerHTML = "<p class='empty'>No donor interest received yet.</p>";
                return;
            }

            const donorIds = [...new Set(items.map(item => item.donor_id))];
            const wishlistIds = [...new Set(items.map(item => item.wishlist_item_id).filter(Boolean))];
            const birthdayIds = [...new Set(items.map(item => item.birthday_request_id).filter(Boolean))];

            const [profiles, wishlist, birthdays] = await Promise.all([
                db.from("profiles").select("id, full_name").in("id", donorIds),
                wishlistIds.length
                    ? db.from("wishlist_items").select("id, item_name").in("id", wishlistIds)
                    : Promise.resolve({ data: [], error: null }),
                birthdayIds.length
                    ? db.from("birthday_requests").select("id, title").in("id", birthdayIds)
                    : Promise.resolve({ data: [], error: null })
            ]);

            if (profiles.error || wishlist.error || birthdays.error) {
                const issue = profiles.error || wishlist.error || birthdays.error;
                list.innerHTML = "<p class='empty'>Could not load sponsorship details: " + escapeHTML(issue.message) + "</p>";
                return;
            }

            const profileMap = Object.fromEntries(profiles.data.map(item => [item.id, item.full_name]));
            const wishlistMap = Object.fromEntries(wishlist.data.map(item => [item.id, item.item_name]));
            const birthdayMap = Object.fromEntries(birthdays.data.map(item => [item.id, item.title]));

            list.innerHTML = items.map(item => {
                const isWishlist = Boolean(item.wishlist_item_id);
                const requestName = isWishlist
                    ? wishlistMap[item.wishlist_item_id] || "Supply request"
                    : birthdayMap[item.birthday_request_id] || "Birthday meal request";

                let proofSection = "";

                if (item.proof_url) {
                    proofSection = `
                        <div class="proof-panel">
                            <h4>Fulfilment Proof</h4>
                            <p>${escapeHTML(item.proof_message || "No proof message provided.")}</p>
                            <a class="proof-link" href="${escapeHTML(item.proof_url)}" target="_blank" rel="noopener">View Uploaded Proof</a>
                            ${item.proof_submitted_at ? `<p>Submitted: ${new Date(item.proof_submitted_at).toLocaleString()}</p>` : ""}
                            ${item.status === "approved" ? `
                                <div class="proof-review">
                                    <button class="complete-btn" data-type="verify-proof" data-id="${item.id}">Verify & Complete</button>
                                    <button class="retry-btn" data-type="reject-proof" data-id="${item.id}">Reject Proof</button>
                                </div>
                            ` : ""}
                            ${item.status === "completed" ? "<span class='status completed'>Proof verified</span>" : ""}
                        </div>
                    `;
                } else if (item.status === "approved") {
                    proofSection = "<p class='proof-note'>Waiting for donor to upload fulfilment proof.</p>";
                }

                return `
                    <div class="request-card">
                        <h3>${escapeHTML(profileMap[item.donor_id] || "Donor")}</h3>
                        <p>Request: ${escapeHTML(requestName)}</p>
                        <p>Type: ${isWishlist ? "Essential Supply" : "Birthday Meal"}</p>
                        <p>Message: ${escapeHTML(item.message || "No message")}</p>
                        <span class="status ${getStatusClass(item.status)}">${escapeHTML(item.status)}</span>
                        ${item.status === "pending" ? `
                            <div class="actions">
                                <button class="approve" data-type="sponsorship" data-id="${item.id}" data-status="approved">Approve Match</button>
                                <button class="reject" data-type="sponsorship" data-id="${item.id}" data-status="rejected">Reject</button>
                            </div>
                        ` : ""}
                        ${proofSection}
                    </div>
                `;
            }).join("");
        }

        document.addEventListener("click", async function(event) {
            const imageButton = event.target.closest(".image-button");

            if (imageButton) {
                document.getElementById("fullImage").src = imageButton.dataset.image;
                document.getElementById("imagePopup").style.display = "flex";
                return;
            }

            const refreshButton = event.target.closest("[data-refresh]");

            if (refreshButton) {
                await loadDashboard();
                return;
            }

            const actionButton = event.target.closest("button[data-type]");

            if (!actionButton) {
                return;
            }

            const type = actionButton.dataset.type;
            const id = actionButton.dataset.id;
            const status = actionButton.dataset.status;

            if (type === "verify-proof") {
                if (!confirm("Verify this proof and mark the sponsorship as completed?")) {
                    return;
                }

                actionButton.disabled = true;
                actionButton.textContent = "Verifying...";

                const { data, error } = await db
                    .from("sponsorships")
                    .update({
                        status: "completed",
                        verified_at: new Date().toISOString()
                    })
                    .eq("id", id)
                    .eq("status", "approved")
                    .not("proof_url", "is", null)
                    .select("id");

                if (error || !data || data.length === 0) {
                    alert("Could not verify proof: " + (error ? error.message : "No matching proof was found."));
                    await loadDashboard();
                    return;
                }

                alert("Proof verified. Sponsorship marked as completed.");
                await loadDashboard();
                return;
            }

            if (type === "reject-proof") {
                if (!confirm("Reject this proof? The donor will be able to upload a new proof.")) {
                    return;
                }

                actionButton.disabled = true;
                actionButton.textContent = "Updating...";

                const { data, error } = await db
                    .from("sponsorships")
                    .update({
                        proof_url: null,
                        proof_message: null,
                        proof_submitted_at: null,
                        verified_at: null
                    })
                    .eq("id", id)
                    .eq("status", "approved")
                    .select("id");

                if (error || !data || data.length === 0) {
                    alert("Could not reject proof: " + (error ? error.message : "No matching sponsorship was found."));
                    await loadDashboard();
                    return;
                }

                alert("Proof rejected. Donor can submit a new proof.");
                await loadDashboard();
                return;
            }

            const tables = {
                orphanage: "orphanages",
                wishlist: "wishlist_items",
                birthday: "birthday_requests",
                sponsorship: "sponsorships"
            };

            const table = tables[type];

            if (!table) {
                return;
            }

            const actionText = status === "approved" ? "approve" : "reject";

            if (!confirm("Are you sure you want to " + actionText + " this request?")) {
                return;
            }

            actionButton.disabled = true;
            actionButton.textContent = "Please wait...";

            const { data, error } = await db
                .from(table)
                .update({ status: status })
                .eq("id", id)
                .select("id");

            if (error) {
                alert("Could not update request: " + error.message);
                actionButton.disabled = false;
                actionButton.textContent = status === "approved" ? "Approve" : "Reject";
                return;
            }

            if (!data || data.length === 0) {
                alert("No record was updated. Please check the admin database permissions.");
                await loadDashboard();
                return;
            }

            alert(type === "sponsorship"
                ? "Sponsorship request " + status + "."
                : "Request " + status + " successfully.");

            await loadDashboard();
        });

        document.getElementById("closePopup").addEventListener("click", function() {
            document.getElementById("imagePopup").style.display = "none";
            document.getElementById("fullImage").src = "";
        });

        document.getElementById("imagePopup").addEventListener("click", function(event) {
            if (event.target === this) {
                this.style.display = "none";
                document.getElementById("fullImage").src = "";
            }
        });

        document.getElementById("logoutBtn").addEventListener("click", async function() {
            await db.auth.signOut();
            window.location.href = "login.html";
        });

        async function startDashboard() {
            if (!db) {
                document.getElementById("mainMessage").textContent = "Database connection failed.";
                return;
            }

            const isAdmin = await checkAdmin();

            if (isAdmin) {
                await loadDashboard();
            }
        }

        startDashboard();
