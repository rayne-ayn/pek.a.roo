import { auth, db } from "../firebase/config.js";

import {
  collection, getDocs, addDoc, query, where,
  doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Helpers ──────────────────────────────────────────────
export function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function path() { return window.location.pathname; }

// ── Login ─────────────────────────────────────────────────
window.login = async function() {
  const email    = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    const role = snap.exists() ? snap.data().role : "customer";
    showToast("Login successful!");
    setTimeout(() => {
      window.location.href = role === "rider" ? "rider-dashboard.html" : "dashboard.html";
    }, 1200);
  } catch (e) { showToast(e.message); }
}

// ── Signup ────────────────────────────────────────────────
window.signup = async function() {
  const fname    = document.getElementById("fname").value.trim();
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const phone    = document.getElementById("phone").value.trim();
  const roleEl   = document.getElementById("role");
  const role     = roleEl ? roleEl.value : "customer";
  const address  = role === "customer" ? (document.getElementById("address")?.value.trim() || "") : "";
  const vehicle  = role === "rider"    ? (document.getElementById("vehicle")?.value.trim() || "") : "";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    await setDoc(doc(db, "users", user.uid), {
      id: user.uid, fname, email, phone, role,
      address, vehicle,
      status: role === "rider" ? "available" : null,
      dateCreated: new Date()
    });
    showToast("Account created!");
    setTimeout(() => window.location.href = "index.html", 1500);
  } catch (e) { showToast(e.message); }
}

// ── Reset Password ────────────────────────────────────────
window.resetPassword = function() {
  const email = document.getElementById("email").value;
  sendPasswordResetEmail(auth, email)
    .then(() => showToast("Reset email sent! Check your inbox."))
    .catch(e => showToast(e.message));
}

// ── Logout ────────────────────────────────────────────────
window.logout = function() {
  signOut(auth).then(() => {
    showToast("Logged out!");
    window.location.href = "index.html";
  });
}

// ── Auth Guard + Role Routing ─────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const p = path();

  // Redirect already-logged-in users away from login page
  if (user && p.includes("index.html")) {
    const snap = await getDoc(doc(db, "users", user.uid));
    const role = snap.exists() ? snap.data().role : "customer";
    window.location.replace(role === "rider" ? "rider-dashboard.html" : "dashboard.html");
    return;
  }

  // Guard protected pages
  const protected_pages = ["dashboard.html","cart.html","rider-dashboard.html","profile.html","riders.html","my-orders.html"];
  if (!user && protected_pages.some(pg => p.includes(pg))) {
    window.location.replace("index.html");
    return;
  }

  // Customer dashboard setup
  if (user && p.includes("dashboard.html") && !p.includes("rider-dashboard.html")) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();

      if (data.role === "rider") { window.location.replace("rider-dashboard.html"); return; }
      const el = document.getElementById("welcomeText");
      if (el) el.innerText = "Welcome, " + data.fname + "!";
    }
    loadStores();
  }

  // Rider dashboard setup
  if (user && p.includes("rider-dashboard.html")) {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.role !== "rider") { window.location.replace("dashboard.html"); return; }
      const el = document.getElementById("riderName");
      if (el) el.innerText = "Hey, " + data.fname + "!";
    }
    loadRiderQueue();
  }
});

// ── Load Stores (customer dashboard) ─────────────────────
async function loadStores() {
  const storeList = document.getElementById("storeList");
  if (!storeList) return;
  const snap = await getDocs(collection(db, "stores"));
  storeList.innerHTML = "";
  snap.forEach(d => {
    const s = d.data();
    storeList.innerHTML += `
      <div class="card">
        <h3>${s.name}</h3>
        <p>${s.category}</p>
        <p>${s.address}</p>
        <button onclick="viewProducts('${d.id}')">View Products</button>
      </div>`;
  });
}

window.viewProducts = async function(storeId) {
  const q    = query(collection(db, "products"), where("storeId", "==", storeId));
  const snap = await getDocs(q);
  const storeList = document.getElementById("storeList");
  storeList.innerHTML = `<div class="products-title"><p>One click away from deliciousness!</p></div>`;
  snap.forEach(d => {
    const p = d.data();
    storeList.innerHTML += `
      <div class="card">
        <h4>${p.name}</h4>
        <p class="price">₱${p.price}</p>
        <button onclick="addToCart('${d.id}','${p.name}',${p.price})">Add to Cart</button>
      </div>`;
  });
}

// ── Cart ──────────────────────────────────────────────────
window.addToCart = function(id, name, price) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let ex = cart.find(i => i.id === id);
  if (ex) ex.quantity += 1;
  else cart.push({ id, name, price, quantity: 1 });
  localStorage.setItem("cart", JSON.stringify(cart));
  showToast("Added to cart!");
}

window.removeFromCart = function(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  if (typeof patchCart === "function") patchCart();
}

// ── Checkout ──────────────────────────────────────────────
window.checkout = async function() {
  const user = auth.currentUser;
  if (!user) { showToast("You must login first"); return; }
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (!cart.length) { showToast("Cart is empty"); return; }
  try {
    const userDoc  = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    let total = 0;
    cart.forEach(i => total += i.price * i.quantity);
    const orderRef = await addDoc(collection(db, "orders"), {
      userId: user.uid, status: "pending", amount: total,
      deliveryAddress: userData.address, date: new Date(),
      riderId: null, riderName: null
    });
    const orderId = orderRef.id;
    for (let item of cart) {
      await addDoc(collection(db, "order_items"), {
        orderId, productId: item.id, quantity: item.quantity, unitPrice: item.price
      });
    }
    await addDoc(collection(db, "payments"), {
      orderId, method: "COD", status: "pending", amount: total, date: new Date()
    });
    localStorage.removeItem("cart");
    showToast("Order placed!");
    setTimeout(() => window.location.href = "dashboard.html", 1500);
  } catch (e) { showToast(e.message); }
}

// ── Rider: load order queue ───────────────────────────────
async function loadRiderQueue() {
  const queueDiv = document.getElementById("orderQueue");
  if (!queueDiv) return;

  // Orders that are pending and not yet assigned to a rider
  const q    = query(collection(db, "orders"), where("status", "==", "pending"), where("riderId", "==", null));
  const snap = await getDocs(q);

  if (snap.empty) {
    queueDiv.innerHTML = `<p class="empty-msg">No pending orders right now. Check back soon!</p>`;
    return;
  }

  queueDiv.innerHTML = "";
  snap.forEach(d => {
    const o = d.data();
    const date = o.date?.toDate ? o.date.toDate().toLocaleString() : "—";
    queueDiv.innerHTML += `
      <div class="order-card" id="order-${d.id}">
        <div class="order-card-info">
          <p class="order-label">Order #${d.id.slice(-6).toUpperCase()}</p>
          <p class="order-address">📍 ${o.deliveryAddress || "No address"}</p>
          <p class="order-meta">₱${o.amount?.toFixed(2)} &nbsp;·&nbsp; ${date}</p>
        </div>
        <div class="order-card-actions">
          <button class="btn-accept" onclick="acceptOrder('${d.id}')">Accept</button>
          <button class="btn-decline" onclick="declineOrder('${d.id}')">Skip</button>
        </div>
      </div>`;
  });
}

window.acceptOrder = async function(orderId) {
  const user = auth.currentUser;
  if (!user) return;
  const snap = await getDoc(doc(db, "users", user.uid));
  const riderName = snap.exists() ? snap.data().fname : "Rider";
  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: "accepted", riderId: user.uid, riderName
    });
    showToast("Order accepted!");
    document.getElementById("order-" + orderId)?.remove();
    loadMyDeliveries();
  } catch(e) { showToast(e.message); }
}

window.declineOrder = function(orderId) {
  // Just remove from view; order stays in queue for other riders
  document.getElementById("order-" + orderId)?.remove();
  showToast("Skipped.");
}

// ── Rider: my active deliveries ───────────────────────────
export async function loadMyDeliveries() {
  const user = auth.currentUser;
  if (!user) return;
  const myDiv = document.getElementById("myDeliveries");
  if (!myDiv) return;

  const q    = query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "accepted"));
  const snap = await getDocs(q);

  if (snap.empty) { myDiv.innerHTML = `<p class="empty-msg">No active deliveries.</p>`; return; }

  myDiv.innerHTML = "";
  snap.forEach(d => {
    const o = d.data();
    myDiv.innerHTML += `
      <div class="order-card">
        <div class="order-card-info">
          <p class="order-label">Order #${d.id.slice(-6).toUpperCase()}</p>
          <p class="order-address">📍 ${o.deliveryAddress || "—"}</p>
          <p class="order-meta">₱${o.amount?.toFixed(2)}</p>
        </div>
        <button class="btn-delivered" onclick="markDelivered('${d.id}')">Mark Delivered</button>
      </div>`;
  });
}

window.markDelivered = async function(orderId) {
  try {
    await updateDoc(doc(db, "orders", orderId), { status: "delivered" });
    // also update payment
    const pSnap = await getDocs(query(collection(db, "payments"), where("orderId", "==", orderId)));
    pSnap.forEach(async pd => {
      await updateDoc(doc(db, "payments", pd.id), { status: "paid" });
    });
    showToast("Marked as delivered!");
    loadMyDeliveries();
  } catch(e) { showToast(e.message); }
}