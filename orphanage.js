const db = window.hopebridgeSupabase;

        let currentUser;
        let orphanageId;

        const wishlistForm = document.getElementById("wishlistForm");
        const birthdayForm = document.getElementById("birthdayForm");

        async function uploadImage(file) {
            if (!file) {
                return null;
            }

            if (file.size > 5 * 1024 * 1024) {
                throw new Error("Image size must be less than 5 MB.");
            }

            const fileName = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const filePath = currentUser.id + "/" + fileName;

            const { error } = await db.storage
                .from("hopebridge-images")
                .upload(filePath, file);

            if (error) {
                throw error;
            }

            const { data } = db.storage
                .from("hopebridge-images")
                .getPublicUrl(filePath);

            return data.publicUrl;
        }

        async function loadDashboard() {
            const { data, error } = await db.auth.getUser();

            if (error || !data.user) {
                window.location.href = "login.html";
                return;
            }

            currentUser = data.user;

            const { data: profile, error: profileError } = await db
                .from("profiles")
                .select("full_name, role")
                .eq("id", currentUser.id)
                .single();

            if (profileError || !profile || profile.role !== "orphanage") {
                alert("Orphanage account not found.");
                await db.auth.signOut();
                window.location.href = "login.html";
                return;
            }

            document.getElementById("orphanageName").textContent = profile.full_name;

            const { data: orphanage, error: orphanageError } = await db
                .from("orphanages")
                .select("id, status")
                .eq("user_id", currentUser.id)
                .single();

            if (orphanageError || !orphanage) {
                document.getElementById("profileStatus").textContent = "Orphanage profile could not be loaded.";
                return;
            }

            orphanageId = orphanage.id;

            document.getElementById("profileStatus").textContent =
                "Verification status: " + orphanage.status;

            await loadWishlist();
            await loadBirthdays();
        }

        wishlistForm.addEventListener("submit", async function(event) {
            event.preventDefault();

            const message = document.getElementById("wishlistMessage");
            message.textContent = "Submitting request...";

            try {
                const image = document.getElementById("itemImage").files[0];
                const imageUrl = await uploadImage(image);

                const { data: item, error } = await db
                    .from("wishlist_items")
                    .insert({
                        orphanage_id: orphanageId,
                        item_name: document.getElementById("itemName").value.trim(),
                        description: document.getElementById("itemDescription").value.trim(),
                        quantity: Number(document.getElementById("itemQuantity").value),
                        image_url: imageUrl
                    })
                    .select("id")
                    .single();

                if (error) {
                    throw error;
                }

                const { error: contactError } = await db
                    .from("request_contacts")
                    .insert({
                        wishlist_item_id: item.id,
                        caretaker_name: document.getElementById("wishlistCaretakerName").value.trim(),
                        phone: document.getElementById("wishlistCaretakerPhone").value.trim(),
                        email: document.getElementById("wishlistCaretakerEmail").value.trim()
                    });

                if (contactError) {
                    message.textContent = "Request saved, but caretaker details could not be saved: " + contactError.message;
                    message.style.color = "red";
                    await loadWishlist();
                    return;
                }

                message.textContent = "Wishlist request and caretaker details submitted successfully!";
                message.style.color = "green";

                wishlistForm.reset();
                await loadWishlist();

            } catch (error) {
                message.textContent = error.message;
                message.style.color = "red";
            }
        });

        birthdayForm.addEventListener("submit", async function(event) {
            event.preventDefault();

            const message = document.getElementById("birthdayMessage");
            message.textContent = "Submitting request...";

            try {
                const image = document.getElementById("birthdayImage").files[0];
                const imageUrl = await uploadImage(image);

                const { data: birthday, error } = await db
                    .from("birthday_requests")
                    .insert({
                        orphanage_id: orphanageId,
                        title: document.getElementById("birthdayTitle").value.trim(),
                        description: document.getElementById("birthdayDescription").value.trim(),
                        meal_date: document.getElementById("mealDate").value,
                        children_count: Number(document.getElementById("childrenCount").value),
                        estimated_cost: Number(document.getElementById("estimatedCost").value),
                        image_url: imageUrl
                    })
                    .select("id")
                    .single();

                if (error) {
                    throw error;
                }

                const { error: contactError } = await db
                    .from("request_contacts")
                    .insert({
                        birthday_request_id: birthday.id,
                        caretaker_name: document.getElementById("birthdayCaretakerName").value.trim(),
                        phone: document.getElementById("birthdayCaretakerPhone").value.trim(),
                        email: document.getElementById("birthdayCaretakerEmail").value.trim()
                    });

                if (contactError) {
                    message.textContent = "Birthday request saved, but caretaker details could not be saved: " + contactError.message;
                    message.style.color = "red";
                    await loadBirthdays();
                    return;
                }

                message.textContent = "Birthday request and caretaker details submitted successfully!";
                message.style.color = "green";

                birthdayForm.reset();
                await loadBirthdays();

            } catch (error) {
                message.textContent = error.message;
                message.style.color = "red";
            }
        });


        async function loadWishlist() {
            const list = document.getElementById("wishlistList");

            const { data, error } = await db
                .from("wishlist_items")
                .select("*")
                .eq("orphanage_id", orphanageId)
                .order("created_at", { ascending: false });

            if (error) {
                list.innerHTML = "<p class='empty'>Could not load wishlist requests.</p>";
                return;
            }

            if (!data.length) {
                list.innerHTML = "<p class='empty'>No wishlist requests added yet.</p>";
                return;
            }

            list.innerHTML = data.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button type="button" class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.item_name)}</h3>
                    <p>${escapeHTML(item.description || "")}</p>
                    <p>Quantity: ${item.quantity}</p>
                    <span class="status">${escapeHTML(item.status)}</span>
                    ${item.status === "pending" || item.status === "rejected" ? `
                        <button type="button" class="delete-request" data-type="wishlist" data-id="${item.id}">Delete Request</button>
                    ` : ""}
                </div>
            `).join("");
        }

        async function loadBirthdays() {
            const list = document.getElementById("birthdayList");

            const { data, error } = await db
                .from("birthday_requests")
                .select("*")
                .eq("orphanage_id", orphanageId)
                .order("created_at", { ascending: false });

            if (error) {
                list.innerHTML = "<p class='empty'>Could not load birthday requests.</p>";
                return;
            }

            if (!data.length) {
                list.innerHTML = "<p class='empty'>No birthday requests added yet.</p>";
                return;
            }

            list.innerHTML = data.map(item => `
                <div class="request-card">
                    ${item.image_url ? `<button type="button" class="image-button" data-image="${escapeHTML(item.image_url)}">View Image</button>` : ""}
                    <h3>${escapeHTML(item.title)}</h3>
                    <p>${escapeHTML(item.description || "")}</p>
                    <p>Date: ${escapeHTML(item.meal_date)}</p>
                    <p>Children: ${item.children_count}</p>
                    <p>Estimated cost: ₹${item.estimated_cost}</p>
                    <span class="status">${escapeHTML(item.status)}</span>
                    ${item.status === "pending" || item.status === "rejected" ? `
                        <button type="button" class="delete-request" data-type="birthday" data-id="${item.id}">Delete Request</button>
                    ` : ""}
                </div>
            `).join("");
        }

        async function deleteRequest(type, id, button) {
            const table = type === "wishlist" ? "wishlist_items" : "birthday_requests";
            const contactColumn = type === "wishlist" ? "wishlist_item_id" : "birthday_request_id";
            const label = type === "wishlist" ? "wishlist" : "birthday";

            if (!confirm(`Are you sure you want to delete this ${label} request?`)) {
                return;
            }

            button.disabled = true;
            button.textContent = "Deleting...";

            try {
                // Check ownership and status again before deleting.
                const { data: request, error: checkError } = await db
                    .from(table)
                    .select("id, status, orphanage_id")
                    .eq("id", id)
                    .eq("orphanage_id", orphanageId)
                    .single();

                if (checkError || !request) {
                    throw new Error("Request could not be found.");
                }

                if (request.status !== "pending" && request.status !== "rejected") {
                    throw new Error("Approved requests cannot be deleted.");
                }

                const { error: contactError } = await db
                    .from("request_contacts")
                    .delete()
                    .eq(contactColumn, id);

                if (contactError) {
                    throw contactError;
                }

                const { error: deleteError } = await db
                    .from(table)
                    .delete()
                    .eq("id", id)
                    .eq("orphanage_id", orphanageId)
                    .in("status", ["pending", "rejected"]);

                if (deleteError) {
                    throw deleteError;
                }

                if (type === "wishlist") {
                    await loadWishlist();
                } else {
                    await loadBirthdays();
                }
            } catch (error) {
                alert("Could not delete request: " + error.message);
                button.disabled = false;
                button.textContent = "Delete Request";
            }
        }

        function escapeHTML(value) {
            return String(value).replace(/[&<>"']/g, function(char) {
                return {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                }[char];
            });
        }

        document.getElementById("logoutBtn").addEventListener("click", async function() {
            await db.auth.signOut();
            window.location.href = "login.html";
        });


        document.addEventListener("click", function(event) {
            const deleteButton = event.target.closest(".delete-request");
            if (deleteButton) {
                deleteRequest(deleteButton.dataset.type, deleteButton.dataset.id, deleteButton);
                return;
            }

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

        loadDashboard();
