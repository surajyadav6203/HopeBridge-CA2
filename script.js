async function loadImpactStats() {
            const message = document.getElementById("impactMessage");

            if (!window.hopebridgeSupabase) {
                message.textContent = "Impact statistics are temporarily unavailable.";
                return;
            }

            const { data, error } = await window.hopebridgeSupabase.rpc("get_homepage_stats");

            if (error || !data) {
                message.textContent = "Could not load the latest impact statistics.";
                console.error("Impact statistics error:", error);
                return;
            }

            document.getElementById("fulfilledCount").textContent = data.fulfilled ?? 0;
            document.getElementById("pendingCount").textContent = data.pending ?? 0;
            document.getElementById("orphanageCount").textContent = data.orphanages ?? 0;
            message.textContent = "Statistics are updated from HopeBridge records.";
        }

        loadImpactStats();
