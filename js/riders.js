import { auth, db } from "../firebase/config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("index.html"); return; }
  loadRiders();
});

async function loadRiders() {
  const riderList = document.getElementById("riderList");
  if (!riderList) return;

  const snap = await getDocs(collection(db, "riders"));

  if (snap.empty) {
    riderList.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:60px 0; color:var(--brown-soft);">
        <p style="font-size:15px;">No riders found. Add some in your Firebase console!</p>
      </div>`;
    return;
  }

  riderList.innerHTML = "";

  snap.forEach((docItem) => {
    const r = docItem.data();
    const initial = (r.fname || "R")[0].toUpperCase();
    const statusClass = (r.status || "offline").toLowerCase();
    const statusLabel = r.status
      ? r.status.charAt(0).toUpperCase() + r.status.slice(1)
      : "Offline";

    riderList.innerHTML += `
      <div class="rider-card">
        <div class="rider-top">
          <div class="rider-avatar">${initial}</div>
          <div>
            <h3 class="rider-name">${r.fname || "Unknown"}</h3>
            <p class="rider-vehicle"> ${r.vehicle || "—"}</p>
          </div>
        </div>
        <p class="rider-detail"><strong>Phone:</strong> ${r.phone || "—"}</p>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>`;
  });
}