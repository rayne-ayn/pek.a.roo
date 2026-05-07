import { auth, db } from "../firebase/config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

let userRole = "customer";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("index.html"); return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;
  const data = snap.data();
  userRole = data.role || "customer";

  setValue("fname",   data.fname   || "");
  setValue("email",   data.email   || user.email);
  setValue("phone",   data.phone   || "");
  setValue("address", data.address || "");
  setValue("vehicle", data.vehicle || "");

  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.value = data.status || "available";

  document.getElementById("profileName").innerText   = data.fname || "User";
  document.getElementById("profileEmail").innerText  = data.email || user.email;
  document.getElementById("avatarInitial").innerText = (data.fname || "U")[0].toUpperCase();
});

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// editable fields differ by role
function editableFields() {
  return userRole === "rider"
    ? ["fname", "phone", "vehicle", "status"]
    : ["fname", "phone", "address"];
}

window.toggleEdit = function() {
  const editBtn  = document.getElementById("editBtn");
  const saveBtn  = document.getElementById("saveBtn");
  const isEditing = editBtn.innerText === "Cancel";

  editableFields().forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = isEditing;
  });

  if (isEditing) {
    editBtn.innerText = "Edit Profile";
    saveBtn.style.display = "none";
  } else {
    editBtn.innerText = "Cancel";
    saveBtn.style.display = "";
    document.getElementById("fname")?.focus();
  }
}

window.saveProfile = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const fname = document.getElementById("fname")?.value.trim();
  if (!fname) { showToast("Name cannot be empty."); return; }

  const updates = { fname,
    phone:   document.getElementById("phone")?.value.trim() || "",
  };
  if (userRole === "rider") {
    updates.vehicle = document.getElementById("vehicle")?.value.trim() || "";
    updates.status  = document.getElementById("status")?.value || "available";
  } else {
    updates.address = document.getElementById("address")?.value.trim() || "";
  }

  try {
    await updateDoc(doc(db, "users", user.uid), updates);
    document.getElementById("profileName").innerText   = fname;
    document.getElementById("avatarInitial").innerText = fname[0].toUpperCase();

    editableFields().forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
    document.getElementById("editBtn").innerText    = "Edit Profile";
    document.getElementById("saveBtn").style.display = "none";
    showToast("Profile updated!");
  } catch (e) { showToast(e.message); }
}