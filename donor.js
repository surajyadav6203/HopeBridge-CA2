const db = window.hopebridgeSupabase;

        let currentUser;
        let sponsorships = [];

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

        function statusClass(status) {
            if (status === "approved") return "approved";
            if (status === "rejected") return "rejected";
            if (status === "completed") return "completed";
            return "";
        }

        async function checkDonor() {
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

            if (profileError || !profile || profile.role !== "donor") {
                alert("Donor account required.");
                await db.auth.signOut();
                window.location.href = "login.html";
                return false;
            }

            document.getElementById("donorName").textContent = profile.full_name;

            return true;
        }

        async function loadRequests() {
            const message = document.getElementById("mainMessage");

            const [wishlist, birthdays, mySponsorships] = await Promise.all([
                db.from("wishlist_items")
                    .select("*")
                    .eq("status", "approved"),

                db.from("birthday_requests")
                    .select("*")
                    .eq("status", "approved"),

                db.from("sponsorships")
                    .select("*")
                    .eq("donor_id", currentUser.id)
            ]);

            if (wishlist.error || birthdays.error || mySponsorships.error) {
                message.textContent = "Could not load requests. Please refresh the page.";
                return;
            }

            sponsorships = mySponsorships.data || [];

            showWishlist(wishlist.data || []);
            showBirthdays(birthdays.data || []);
            await showSponsorships(sponsorships);
        }

        function alreadyRequested(type, id) {
            return sponsorships.some(item => {
                if (type === "wishlist") {
                    return item.wishlist_item_id === id;
                }

                return item.birthday_request_id === id;
            });
        }

        function showWishlist(items) {
            const list = document.getElementById("wishlistList");

            if (!items.length) {
                list.innerHTML = "<p class='empty'>No approved supply requests available right now.</p>";
                return;
            }

            list.innerHTML = items.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.item_name)}</h3>
                    <p>${escapeHTML(item.description)}</p>
                    <p>Quantity needed: ${item.quantity}</p>
                    ${alreadyRequested("wishlist", item.id)
                        ? "<span class='status'>Interest submitted</span>"
                        : `<button class="sponsor-btn" data-type="wishlist" data-id="${item.id}">I'm Ready to Fulfil</button>`
                    }
                </div>
            `).join("");
        }

        function showBirthdays(items) {
            const list = document.getElementById("birthdayList");

            if (!items.length) {
                list.innerHTML = "<p class='empty'>No approved birthday requests available right now.</p>";
                return;
            }

            list.innerHTML = items.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.title)}</h3>
                    <p>${escapeHTML(item.description)}</p>
                    <p>Date: ${escapeHTML(item.meal_date)}</p>
                    <p>Children: ${item.children_count}</p>
                    <p>Estimated cost: ₹${item.estimated_cost}</p>
                    ${alreadyRequested("birthday", item.id)
                        ? "<span class='status'>Interest submitted</span>"
                        : `<button class="sponsor-btn" data-type="birthday" data-id="${item.id}">I'm Ready to Fulfil</button>`
                    }
                </div>
            `).join("");
        }

        async function showSponsorships(items) {
            const list = document.getElementById("sponsorshipList");

            if (!items.length) {
                list.innerHTML = "<p class='empty'>You have not submitted any sponsorship interests yet.</p>";
                return;
            }

            const cards = await Promise.all(items.map(async function(item) {
                const isWishlist = Boolean(item.wishlist_item_id);
                const requestId = item.wishlist_item_id || item.birthday_request_id;
                let contactHtml = "";
                let proofHtml = "";

                if (item.status === "approved") {
                    const contactColumn = isWishlist ? "wishlist_item_id" : "birthday_request_id";
                    const { data: contact, error: contactError } = await db
                        .from("request_contacts")
                        .select("caretaker_name, phone, email")
                        .eq(contactColumn, requestId)
                        .maybeSingle();

                    if (contact && !contactError) {
                        contactHtml = `
                            <div class="contact-box">
                                <h4>Request Caretaker Contact</h4>
                                <p><strong>Name:</strong> ${escapeHTML(contact.caretaker_name)}</p>
                                <p><strong>Phone:</strong> ${escapeHTML(contact.phone)}</p>
                                <p><strong>Email:</strong> ${escapeHTML(contact.email)}</p>
                            </div>
                        `;
                    } else {
                        contactHtml = "<p class='proof-note'>Caretaker contact details are not available yet.</p>";
                    }

                    if (item.proof_url) {
                        proofHtml = `
                            <div class="contact-box">
                                <h4>Fulfilment Proof Submitted</h4>
                                <p>${escapeHTML(item.proof_message || "Proof uploaded for admin review.")}</p>
                                <a href="${escapeHTML(item.proof_url)}" target="_blank" rel="noopener">View uploaded proof</a>
                            </div>
                        `;
                    } else {
                        proofHtml = `
                            <form class="proof-form" data-proof-id="${item.id}">
                                <h4>Upload Fulfilment Proof</h4>
                                <input type="file" name="proofImage" accept="image/jpeg,image/png,image/webp" required>
                                <textarea name="proofMessage" rows="2" placeholder="Add a short note about the fulfilment" required></textarea>
                                <button type="submit">Submit Proof</button>
                                <p class="proof-note">Admin will review your proof and update the request status.</p>
                            </form>
                        `;
                    }
                }

                return `
                    <div class="request-card">
                        <h3>${isWishlist ? "Supply Sponsorship" : "Birthday Meal Sponsorship"}</h3>
                        <p>Request ID: ${escapeHTML(requestId)}</p>
                        <p>Message: ${escapeHTML(item.message || "No message")}</p>
                        <span class="status ${statusClass(item.status)}">${escapeHTML(item.status)}</span>
                        ${item.status === "pending" ? `<button class="cancel-interest-btn" data-cancel-sponsorship="${escapeHTML(item.id)}">Cancel Interest</button>` : ""}
                        ${contactHtml}
                        ${proofHtml}
                    </div>
                `;
            }));

            list.innerHTML = cards.join("");
        }

        document.addEventListener("click", async function(event) {
            const cancelButton = event.target.closest("button[data-cancel-sponsorship]");

            if (!cancelButton) return;

            const sponsorshipId = cancelButton.dataset.cancelSponsorship;
            const confirmed = confirm("Are you sure you want to cancel this sponsorship interest?");

            if (!confirmed) return;

            cancelButton.disabled = true;
            cancelButton.textContent = "Cancelling...";

            const { error } = await db
                .from("sponsorships")
                .delete()
                .eq("id", sponsorshipId)
                .eq("donor_id", currentUser.id)
                .eq("status", "pending");

            if (error) {
                alert("Could not cancel interest: " + error.message);
                cancelButton.disabled = false;
                cancelButton.textContent = "Cancel Interest";
                return;
            }

            alert("Your sponsorship interest has been cancelled.");
            await loadRequests();
        });

        document.addEventListener("click", async function(event) {
            const button = event.target.closest("button[data-type]");

            if (!button) {
                return;
            }

            const type = button.dataset.type;
            const id = button.dataset.id;

            const message = type === "wishlist"
                ? "I am interested in fulfilling this supply request."
                : "I am interested in sponsoring this birthday meal.";

            button.disabled = true;
            button.textContent = "Submitting...";

            const record = {
                donor_id: currentUser.id,
                message: message,
                status: "pending"
            };

            if (type === "wishlist") {
                record.wishlist_item_id = id;
            } else {
                record.birthday_request_id = id;
            }

            const { error } = await db
                .from("sponsorships")
                .insert(record);

            if (error) {
                alert("Could not submit interest: " + error.message);
                button.disabled = false;
                button.textContent = "I'm Ready to Fulfil";
                return;
            }

            alert("Your sponsorship interest has been submitted!");
            await loadRequests();
        });

        document.addEventListener("submit", async function(event) {
            const form = event.target.closest(".proof-form");

            if (!form) {
                return;
            }

            event.preventDefault();

            const button = form.querySelector("button");
            const file = form.elements.proofImage.files[0];
            const proofMessage = form.elements.proofMessage.value.trim();
            const sponsorshipId = form.dataset.proofId;

            if (!file || file.size > 5 * 1024 * 1024) {
                alert("Please choose an image smaller than 5 MB.");
                return;
            }

            button.disabled = true;
            button.textContent = "Uploading...";

            const filePath = currentUser.id + "/proof-" + sponsorshipId + "-" + Date.now() + "." + file.name.split(".").pop();

            const { error: uploadError } = await db.storage
                .from("hopebridge-images")
                .upload(filePath, file, { upsert: false });

            if (uploadError) {
                alert("Proof upload failed: " + uploadError.message);
                button.disabled = false;
                button.textContent = "Submit Proof";
                return;
            }

            const { data: publicData } = db.storage
                .from("hopebridge-images")
                .getPublicUrl(filePath);

            const { error: updateError } = await db
                .from("sponsorships")
                .update({
                    proof_url: publicData.publicUrl,
                    proof_message: proofMessage,
                    proof_submitted_at: new Date().toISOString()
                })
                .eq("id", sponsorshipId)
                .eq("donor_id", currentUser.id)
                .eq("status", "approved");

            if (updateError) {
                alert("Image uploaded, but proof could not be saved: " + updateError.message);
                button.disabled = false;
                button.textContent = "Submit Proof";
                return;
            }

            alert("Fulfilment proof submitted. Admin can now review it.");
            await loadRequests();
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

            const allowed = await checkDonor();

            if (allowed) {
                await loadRequests();
            }
        }

document.addEventListener("click", function(event) {
    const imageButton = event.target.closest(".image-button");

    if (imageButton) {
        document.getElementById("fullImage").src = imageButton.dataset.image;
        document.getElementById("imagePopup").style.display = "flex";
    }
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

        startDashboard();
