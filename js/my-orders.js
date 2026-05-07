import { auth, db } from "../firebase/config.js";
import {
  collection, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const statusLabel = {
  pending:   { text: "Pending",    cls: "status-pending"   },
  accepted:  { text: "On the way", cls: "status-accepted"  },
  delivered: { text: "Delivered",  cls: "status-delivered" },
};

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("index.html"); return; }
  loadMyOrders(user.uid);
});

async function loadMyOrders(uid) {
  const listDiv = document.getElementById("orderList");
  if (!listDiv) return;

  const q    = query(collection(db, "orders"), where("userId", "==", uid));
  const snap = await getDocs(q);

  if (snap.empty) {
    listDiv.innerHTML = `
      <div class="empty-cart">
        <span>HUNGRY</span>
        <p>No orders yet. <a href="dashboard.html" style="color:var(--green);font-weight:600;">Browse stores →</a></p>
      </div>`;
    return;
  }

  listDiv.innerHTML = "";

  // collect all orderIds to fetch payments in batch
  const orders = [];
  snap.forEach(d => orders.push({ id: d.id, ...d.data() }));

  for (const order of orders) {
    const st = statusLabel[order.status] || { text: order.status, cls: "status-pending" };
    const date = order.date?.toDate ? order.date.toDate().toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" }) : "—";

    // Fetch payment for this order
    let payMethod = "COD";
    let payStatus = "pending";
    const pSnap = await getDocs(query(collection(db, "payments"), where("orderId", "==", order.id)));
    if (!pSnap.empty) {
      const pd = pSnap.docs[0].data();
      payMethod = pd.method || "COD";
      payStatus = pd.status || "pending";
    }

    listDiv.innerHTML += `
      <div class="order-summary-card">
        <div class="order-summary-top">
          <div>
            <p class="order-label">Order #${order.id.slice(-6).toUpperCase()}</p>
            <p class="order-meta">${date}</p>
          </div>
          <span class="status-badge ${st.cls}">${st.text}</span>
        </div>

        <div class="order-summary-row">
          <span>Delivery address</span>
          <span>${order.deliveryAddress || "—"}</span>
        </div>
        <div class="order-summary-row">
          <span>Amount</span>
          <span>₱${order.amount?.toFixed(2) || "0.00"}</span>
        </div>
        <div class="order-summary-row">
          <span>Payment</span>
          <span>${payMethod} · <em>${payStatus}</em></span>
        </div>
        <div class="order-summary-row">
          <span>Rider</span>
          <span>${order.riderName || "Not yet assigned"}</span>
        </div>
      </div>`;
  }
}