// ════════════════════════════════════════════════════════════════════════════
//  Campus Travel Connect — Main Script
//  Backend: Node.js + Express + MongoDB (No Firebase)
// ════════════════════════════════════════════════════════════════════════════

// ── API CONFIGURATION ──────────────────────────────────────────────────────────
const API_URL =
  window.API_URL ||
  "https://campus-travel-connect-2-0.onrender.com/api"; // Override with window.API_URL in production if needed
let authToken = localStorage.getItem("authToken") || null;

// API Helper Functions
const API = {
  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Request failed");
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  get: (endpoint) => API.request(endpoint, { method: "GET" }),
  post: (endpoint, body) =>
    API.request(endpoint, { method: "POST", body: JSON.stringify(body) }),
  put: (endpoint, body) =>
    API.request(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  delete: (endpoint) => API.request(endpoint, { method: "DELETE" }),

  // File upload helper
  async upload(endpoint, formData) {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed");
    return data;
  },
};

// ── STATE ────────────────────────────────────────────────────────────────────
let currentUser = null;
let currentUserData = null;
let viewingUserId = null;
let activeChatId = null;

// ── INIT — Check Auth on Page Load ───────────────────────────────────────────
async function initAuth() {
  const token = localStorage.getItem("authToken");
  if (token) {
    authToken = token;
    try {
      const data = await API.get("/auth/me");
      currentUser = { uid: data.user._id, email: data.user.email };
      currentUserData = data.user;
      setHeader();
      switchPage("casePage");
    } catch (e) {
      localStorage.removeItem("authToken");
      authToken = null;
      switchPage("authPage");
    }
  } else {
    switchPage("authPage");
  }
  document.getElementById("loadingScreen").classList.add("hidden");
}

// Initialize on page load
initAuth();

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

function switchPage(id) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const greeting = document.getElementById("userGreeting");
  if (greeting) {
    if (id === "casePage") greeting.classList.add("home-page");
    else greeting.classList.remove("home-page");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function setHeader() {
  const bar = document.getElementById("userBar");
  if (currentUser && currentUserData) {
    const greetings = ["Hey", "Hello", "Hola", "Hi"];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    let n = (currentUserData.name || "").split(" ")[0];
    if (!n || n.toLowerCase() === "new")
      n = currentUser.email.split("@")[0].split(".")[0];
    document.getElementById("userGreeting").textContent = `👋 ${g} ${n}!!!`;
    bar.classList.remove("hidden");
    const sideAvatar = document.getElementById("sidebarUserAvatar");
    if (sideAvatar) {
      sideAvatar.textContent = getInitials(currentUserData.name);
      sideAvatar.style.backgroundImage = currentUserData.photoURL
        ? `url(${currentUserData.photoURL})`
        : "";
      sideAvatar.style.fontSize = currentUserData.photoURL ? "0" : "";
      document.getElementById("sidebarUserName").textContent =
        currentUserData.name || "User";
      document.getElementById("sidebarUserEmail").textContent =
        currentUser.email || "";
    }
    updateNotificationBadges();
  } else {
    bar.classList.add("hidden");
  }
}

async function updateNotificationBadges() {
  if (!currentUser) return;
  try {
    const data = await API.get("/join-requests/received");
    const pending = (data.requests || []).filter((r) => r.status === "pending");
    const notifBadge = document.getElementById("notifBadge");
    if (notifBadge) {
      if (pending.length > 0) {
        notifBadge.textContent = pending.length;
        notifBadge.classList.remove("hidden");
      } else {
        notifBadge.classList.add("hidden");
      }
    }
  } catch (e) {
    console.log("Could not update badges:", e);
  }
}

function setAvatar(el, name, photoURL) {
  if (photoURL) {
    el.style.backgroundImage = `url(${photoURL})`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.textContent = "";
    el.style.fontSize = "0";
  } else {
    el.style.backgroundImage = "";
    el.style.fontSize = "";
    el.textContent = getInitials(name);
  }
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarBackdrop").classList.remove("hidden");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.add("hidden");
}
function sidebarNav(fn) {
  closeSidebar();
  setTimeout(fn, 200);
}
function goHome() {
  sidebarNav(() => switchPage("casePage"));
}
function goDashboard() {
  sidebarNav(() => {
    loadDashboard();
    switchPage("dashboardPage");
  });
}
function goMyProfile() {
  sidebarNav(() => {
    loadMyProfile();
    switchPage("profilePage");
  });
}
function goMessages() {
  sidebarNav(() => {
    loadChatList();
    switchPage("chatListPage");
  });
}
function goFindMatch() {
  sidebarNav(() => openMatchPage());
}
function goGroupFinder() {
  sidebarNav(() => openRoutePage());
}
function goExperience() {
  sidebarNav(async () => {
    resetExperiencePage();
    switchPage("experiencePage");
    const sel = document.getElementById("journeySelect");
    if (!sel || !currentUser) return;
    sel.innerHTML = '<option value="">Loading journeys...</option>';
    try {
      const data = await API.get("/listings/my-journeys");
      const listings = data.listings || [];
      if (listings.length === 0) {
        sel.innerHTML = '<option value="">No past journeys found</option>';
      } else {
        sel.innerHTML = '<option value="">Select a journey to rate...</option>';
        listings.forEach((d) => {
          const dest =
            d.type === "match"
              ? `[Trip] ${d.to}`
              : `[Group] ${d.from} ➔ ${d.to}`;
          const opt = document.createElement("option");
          opt.value = d._id;
          opt.textContent = `${d.date || "N/A"} | ${dest}`;
          sel.appendChild(opt);
        });
      }
    } catch (e) {
      sel.innerHTML = '<option value="">Failed to load journeys</option>';
    }
  });
}
function goSettings() {
  sidebarNav(() => {
    loadSettingsPage();
    switchPage("settingsPage");
  });
}
function goReportIssue() {
  sidebarNav(() => switchPage("reportIssuePage"));
}

// ── AUTH FORMS ────────────────────────────────────────────────────────────────
function showLogin() {
  ["loginForm", "signupForm", "forgotPwForm"].forEach((id) =>
    document.getElementById(id).classList.add("hidden"),
  );
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("loginTab").classList.add("active");
  document.getElementById("signupTab").classList.remove("active");
}
function showSignup() {
  ["loginForm", "signupForm", "forgotPwForm"].forEach((id) =>
    document.getElementById(id).classList.add("hidden"),
  );
  document.getElementById("signupForm").classList.remove("hidden");
  document.getElementById("signupTab").classList.add("active");
  document.getElementById("loginTab").classList.remove("active");
}
function showForgotPw() {
  ["loginForm", "signupForm", "forgotPwForm"].forEach((id) =>
    document.getElementById(id).classList.add("hidden"),
  );
  document.getElementById("forgotPwForm").classList.remove("hidden");
  ["loginTab", "signupTab"].forEach((id) =>
    document.getElementById(id).classList.remove("active"),
  );
}

// ── AUTH ACTIONS ──────────────────────────────────────────────────────────────
async function signup() {
  const name = document.getElementById("signupName").value.trim();
  const reg = document.getElementById("signupReg").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const pw = document.getElementById("signupPassword").value;
  const cpw = document.getElementById("signupConfirmPassword").value;

  const ids = [
    "signupName",
    "signupReg",
    "signupPhone",
    "signupEmail",
    "signupPassword",
    "signupConfirmPassword",
  ];
  let ok = true;
  ids.forEach((id) => {
    const e = document.getElementById(id);
    const empty = !e.value.trim();
    e.classList.toggle("field-error", empty);
    if (empty) ok = false;
  });
  if (!ok) {
    toast("Fill in all fields.", "error");
    return;
  }
  if (!email.endsWith("@vitstudent.ac.in")) {
    toast("Use your VIT email only.", "error");
    return;
  }
  if (!/^\d{10}$/.test(phone)) {
    toast("Enter valid 10-digit phone.", "error");
    return;
  }
  if (pw !== cpw) {
    toast("Passwords do not match.", "error");
    return;
  }
  if (pw.length < 6) {
    toast("Password needs 6+ characters.", "error");
    return;
  }

  const btn = document.getElementById("signupBtn");
  btn.textContent = "Creating...";
  btn.disabled = true;

  try {
    const data = await API.post("/auth/signup", {
      name,
      email,
      password: pw,
      reg,
      phone,
    });
    authToken = data.token;
    localStorage.setItem("authToken", authToken);
    currentUser = { uid: data.user._id, email: data.user.email };
    currentUserData = data.user;
    setHeader();
    switchPage("casePage");
    toast(`Welcome, ${name.split(" ")[0]}! 🚀`, "success");
  } catch (e) {
    let msg = e.message;
    if (msg.includes("already exists"))
      msg = "Account already exists. Please login.";
    toast(msg, "error");
  } finally {
    btn.textContent = "Create Account";
    btn.disabled = false;
  }
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const pw = document.getElementById("loginPassword").value;
  ["loginEmail", "loginPassword"].forEach((id) =>
    document
      .getElementById(id)
      .classList.toggle(
        "field-error",
        !document.getElementById(id).value.trim(),
      ),
  );
  if (!email || !pw) {
    toast("Enter email and password.", "error");
    return;
  }

  const btn = document.getElementById("loginBtn");
  btn.textContent = "Logging in...";
  btn.disabled = true;

  try {
    const data = await API.post("/auth/login", { email, password: pw });
    authToken = data.token;
    localStorage.setItem("authToken", authToken);
    currentUser = { uid: data.user._id, email: data.user.email };
    currentUserData = data.user;
    setHeader();
    switchPage("casePage");
    toast(
      `Welcome back, ${(data.user.name || "traveller").split(" ")[0]}! 🚀`,
      "success",
    );
  } catch (e) {
    let msg = "Login failed. Check credentials.";
    if (e.message.includes("not found"))
      msg = "No account found. Sign up first.";
    if (e.message.includes("Invalid")) msg = "Incorrect password.";
    toast(msg, "error");
  } finally {
    btn.textContent = "Login";
    btn.disabled = false;
  }
}

async function googleSignIn() {
  try {
    // Check if Google Sign-In SDK is loaded
    if (typeof google === "undefined" || !window.GOOGLE_CLIENT_ID) {
      toast(
        "Google Sign-In not configured. Check console for setup guide.",
        "error",
      );
      console.error("❌ Google Sign-In Setup Required:");
      console.log("1. Get Client ID from: https://console.cloud.google.com/");
      console.log(
        "2. Add to index.html: <script>window.GOOGLE_CLIENT_ID = 'YOUR_ID';</script>",
      );
      console.log("3. See GOOGLE-OAUTH-SETUP.md for detailed guide");
      return;
    }

    // Initialize Google Sign-In with popup
    google.accounts.id.initialize({
      client_id: window.GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Create a temporary container for the Google button
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    // Render the button and trigger click
    google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
      type: "standard",
      text: "signin_with",
    });

    // Trigger the button click after a short delay
    setTimeout(() => {
      const googleBtn = container.querySelector('[role="button"]');
      if (googleBtn) {
        googleBtn.click();
      } else {
        // Fallback: show One Tap
        google.accounts.id.prompt();
      }
      // Clean up the container after use
      setTimeout(() => document.body.removeChild(container), 500);
    }, 100);
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    toast("Google Sign-In failed. Try email login.", "error");
  }
}

async function handleGoogleCallback(response) {
  try {
    // Decode JWT token from Google
    const base64Url = response.credential.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );

    const googleUser = JSON.parse(jsonPayload);

    // Send to backend
    const data = await API.post("/auth/google", {
      googleId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      photoURL: googleUser.picture,
    });

    // Store token and user data
    authToken = data.token;
    localStorage.setItem("authToken", authToken);
    currentUser = { uid: data.user._id, email: data.user.email };
    currentUserData = data.user;

    // Update UI
    setHeader();
    switchPage("casePage");
    toast(
      `Welcome, ${googleUser.given_name || data.user.name.split(" ")[0]}! 🎉`,
      "success",
    );
  } catch (error) {
    console.error("Google Auth Error:", error);
    let msg = error.message;
    if (msg.includes("VIT") || msg.includes("student")) {
      msg = "Only VIT students can sign in with Google.";
    }
    toast(msg || "Google Sign-In failed", "error");
  }
}

async function forgotPassword() {
  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) {
    toast("Enter your email.", "error");
    return;
  }
  const btn = document.getElementById("forgotBtn");
  btn.textContent = "Sending...";
  btn.disabled = true;
  try {
    toast("Password reset coming soon. Please contact support.", "info");
    showLogin();
  } catch (e) {
    toast("Failed to send reset email.", "error");
  } finally {
    btn.textContent = "Send Reset Link";
    btn.disabled = false;
  }
}

async function logout() {
  authToken = null;
  localStorage.removeItem("authToken");
  currentUser = null;
  currentUserData = null;
  setHeader();
  switchPage("authPage");
  closeSidebar();
  toast("Logged out. See you! 👋", "info");
}

// ── MY PROFILE ────────────────────────────────────────────────────────────────
async function loadMyProfile() {
  if (!currentUser) return;
  try {
    const data = await API.get("/auth/me");
    currentUserData = data.user;
    setHeader();
    const d = currentUserData;
    setAvatar(
      document.getElementById("profileAvatar"),
      d.name || "",
      d.photoURL || "",
    );
    document.getElementById("profileName").value = d.name || "";
    document.getElementById("profileReg").value = d.reg || "";
    document.getElementById("profileDept").value = d.dept || "";
    document.getElementById("profilePhone").value = d.phone || "";
    document.getElementById("profileExtraEmail").value = d.extraEmail || "";
    document.getElementById("profileExtraPhone").value = d.extraPhone || "";
    document.getElementById("profileBio").value = d.bio || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
  } catch (e) {
    toast("Could not load profile.", "error");
  }
}

async function saveProfile() {
  if (!currentUser) return;
  const name = document.getElementById("profileName").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  const dept = document.getElementById("profileDept").value.trim();
  const extraEmail = document.getElementById("profileExtraEmail").value.trim();
  const extraPhone = document.getElementById("profileExtraPhone").value.trim();
  const bio = document.getElementById("profileBio").value.trim();
  if (!name) {
    toast("Name cannot be empty.", "error");
    return;
  }
  const btn = document.getElementById("saveProfileBtn");
  btn.textContent = "Saving...";
  btn.disabled = true;
  try {
    await API.put("/users/me", {
      name,
      phone,
      dept,
      extraEmail,
      extraPhone,
      bio,
    });
    currentUserData = {
      ...currentUserData,
      name,
      phone,
      dept,
      extraEmail,
      extraPhone,
      bio,
    };
    setHeader();
    toast("Profile updated! ✅", "success");
  } catch (e) {
    toast("Failed to save.", "error");
  } finally {
    btn.textContent = "Save Changes";
    btn.disabled = false;
  }
}

async function uploadProfilePhoto() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be under 5MB.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const data = await API.upload(
        `/users/${currentUser.uid}/photo`,
        formData,
      );
      currentUserData.photoURL = data.photoURL;
      setAvatar(
        document.getElementById("profileAvatar"),
        currentUserData.name,
        data.photoURL,
      );
      setHeader();
      toast("Photo updated!", "success");
    } catch (e) {
      toast("Upload failed.", "error");
    }
  };
  input.click();
}

// ── VIEW USER PROFILE ─────────────────────────────────────────────────────────
async function openUserProfile(uid) {
  if (!uid) return;
  viewingUserId = uid;
  switchPage("userProfilePage");
  try {
    const data = await API.get(`/users/${uid}`);
    const d = data.user;
    setAvatar(
      document.getElementById("viewUserAvatar"),
      d.name || "",
      d.photoURL || "",
    );
    document.getElementById("viewUserName").textContent = d.name || "—";
    document.getElementById("viewUserReg").textContent = d.reg || "—";
    document.getElementById("viewUserDept").textContent = d.dept || "—";
    document.getElementById("viewUserBio").textContent = d.bio || "No bio";
    document.getElementById("viewUserPhone").textContent = d.phone || "—";
  } catch (e) {
    toast("Failed to load user.", "error");
  }
}

async function messageViewedUser() {
  if (!viewingUserId) return;
  try {
    const data = await API.get(`/users/${viewingUserId}`);
    openChatWith(viewingUserId, data.user.name || "User");
  } catch (e) {
    toast("Could not start chat.", "error");
  }
}

// ── TRAVEL MATCH BOARD ────────────────────────────────────────────────────────
function openMatchPage() {
  switchPage("matchPage");
  loadMatches();
}

async function loadMatches() {
  const list = document.getElementById("matchCardList");
  if (!list) return;
  list.innerHTML =
    '<p style="text-align:center; color:#aaa;">Loading matches...</p>';
  try {
    const data = await API.get("/listings?type=match");
    const listings = data.listings || [];
    if (listings.length === 0) {
      list.innerHTML =
        '<p style="text-align:center;color:#888;">No matches yet. Create one!</p>';
      return;
    }
    list.innerHTML = "";
    listings.forEach((d) => {
      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-card-head">
          <div class="match-avatar" onclick="openUserProfile('${d.uid}')">${getInitials(d.name)}</div>
          <div>
            <div class="match-name">${d.name}</div>
            <div class="match-route">${d.from} ➔ ${d.to}</div>
          </div>
        </div>
        <div class="match-details">
          <span>📅 ${d.date || "—"}</span>
          <span>⏰ ${d.time || "—"}</span>
          <span>🚗 ${d.vehicle || "—"}</span>
          <span>👤 ${d.gender || "Any"}</span>
        </div>
        ${d.notes ? `<div class="match-notes">${d.notes}</div>` : ""}
        <div class="match-actions">
          ${d.uid === currentUser?.uid ? `<button class="btn-outline" onclick="deleteListing('${d._id}')">Delete</button>` : `<button onclick="openChatWith('${d.uid}', '${d.name}')">Message</button>`}
        </div>
      `;
      list.appendChild(card);
    });
  } catch (e) {
    list.innerHTML = '<p style="color:red;">Failed to load matches.</p>';
  }
}

async function postMatch() {
  const from = document.getElementById("matchFrom").value.trim();
  const to = document.getElementById("matchTo").value.trim();
  const date = document.getElementById("matchDate").value;
  const time = document.getElementById("matchTime").value;
  const vehicle = document.getElementById("matchVehicle").value;
  const gender = document.getElementById("matchGender").value;
  const notes = document.getElementById("matchNotes").value.trim();

  if (!from || !to || !date || !time) {
    toast("Fill from, to, date and time.", "error");
    return;
  }

  const btn = document.getElementById("postMatchBtn");
  btn.textContent = "Posting...";
  btn.disabled = true;

  try {
    await API.post("/listings", {
      type: "match",
      from,
      to,
      date,
      time,
      vehicle,
      gender,
      notes,
      name: currentUserData.name,
      uid: currentUser.uid,
    });
    toast("Match posted! 🎉", "success");
    closeModal("matchModal");
    loadMatches();
  } catch (e) {
    toast("Failed to post.", "error");
  } finally {
    btn.textContent = "Post Match";
    btn.disabled = false;
  }
}

// ── ROUTE GROUP FINDER ────────────────────────────────────────────────────────
function openRoutePage() {
  switchPage("routePage");
  loadGroups();
}

async function loadGroups() {
  const list = document.getElementById("groupCardList");
  if (!list) return;
  list.innerHTML =
    '<p style="text-align:center; color:#aaa;">Loading groups...</p>';
  try {
    const data = await API.get("/listings?type=group");
    const listings = data.listings || [];
    if (listings.length === 0) {
      list.innerHTML =
        '<p style="text-align:center;color:#888;">No groups yet. Create one!</p>';
      return;
    }
    list.innerHTML = "";
    listings.forEach((d) => renderGroupCard(d, list));
  } catch (e) {
    list.innerHTML = '<p style="color:red;">Failed to load groups.</p>';
  }
}

function renderGroupCard(d, container) {
  const isCreator = d.uid === currentUser?.uid;
  const isMember = d.members?.includes(currentUser?.uid);
  const isFull = d.members?.length >= (d.maxMembers || 4);

  const card = document.createElement("div");
  card.className = "group-card";
  card.innerHTML = `
    <div class="group-card-head">
      <div class="group-avatar" onclick="openUserProfile('${d.uid}')">${getInitials(d.name)}</div>
      <div>
        <div class="group-name">${d.name}</div>
        <div class="group-route">${d.from} ➔ ${d.to}</div>
      </div>
    </div>
    <div class="group-details">
      <span>📅 ${d.date || "—"}</span>
      <span>🚗 ${d.vehicle || "—"}</span>
      <span>👥 ${d.members?.length || 1}/${d.maxMembers || 4}</span>
    </div>
    ${d.notes ? `<div class="group-notes">${d.notes}</div>` : ""}
    <div class="group-actions">
      ${
        isCreator
          ? `<button class="btn-outline" onclick="deleteListing('${d._id}')">Delete</button>`
          : isMember
            ? `<span class="badge">Joined ✓</span>`
            : isFull
              ? `<span class="badge">Full</span>`
              : `<button onclick="requestJoinGroup('${d._id}', '${d.uid}', '${d.to}')">Request to Join</button>`
      }
    </div>
  `;
  container.appendChild(card);
}

async function requestJoinGroup(groupId, creatorId, destination) {
  if (!currentUser) {
    toast("Login first.", "error");
    return;
  }

  try {
    // Check if already requested
    const existing = await API.get(`/join-requests/check/${groupId}`);
    if (existing.exists) {
      toast("You already sent a request!", "info");
      return;
    }

    await API.post("/join-requests", {
      groupId,
      creatorId,
      destination,
      message: `Hi! I'd like to join your trip to ${destination}.`,
    });

    toast("Join request sent! 🎉", "success");
    loadGroups();
  } catch (e) {
    toast(e.message || "Failed to send request.", "error");
  }
}

async function joinGroupDirectly(gid) {
  try {
    await API.post(`/listings/${gid}/join`);
    toast("Joined group! 🎉", "success");
    loadGroups();
  } catch (e) {
    toast("Failed to join.", "error");
  }
}

async function createGroup() {
  const from = document.getElementById("groupFrom").value.trim();
  const to = document.getElementById("groupTo").value.trim();
  const date = document.getElementById("groupDate").value;
  const vehicle = document.getElementById("groupVehicle").value;
  const maxMembers = parseInt(document.getElementById("groupMax").value) || 4;
  const notes = document.getElementById("groupNotes").value.trim();

  if (!from || !to || !date) {
    toast("Fill from, to, and date.", "error");
    return;
  }

  const btn = document.getElementById("createGroupBtn");
  btn.textContent = "Creating...";
  btn.disabled = true;

  try {
    await API.post("/listings", {
      type: "group",
      from,
      to,
      date,
      vehicle,
      maxMembers,
      notes,
      name: currentUserData.name,
      uid: currentUser.uid,
      members: [currentUser.uid],
    });
    toast("Group created! 🎉", "success");
    closeModal("groupModal");
    loadGroups();
  } catch (e) {
    toast("Failed to create group.", "error");
  } finally {
    btn.textContent = "Create Group";
    btn.disabled = false;
  }
}

// ── CHAT / MESSAGING ──────────────────────────────────────────────────────────
async function openChatWith(otherUid, otherName) {
  if (!currentUser || !otherUid) return;
  const chatId = [currentUser.uid, otherUid].sort().join("_");
  activeChatId = chatId;

  document.getElementById("chatHeaderName").textContent = otherName || "Chat";
  document.getElementById("chatMessages").innerHTML =
    '<p style="text-align:center;color:#888;">Loading...</p>';
  switchPage("chatConvPage");

  try {
    const data = await API.get(`/messages/conversation/${chatId}`);
    renderMessages(data.messages || []);
  } catch (e) {
    document.getElementById("chatMessages").innerHTML =
      '<p style="text-align:center;color:#888;">Start a conversation!</p>';
  }
}

function renderMessages(messages) {
  const container = document.getElementById("chatMessages");
  if (!messages.length) {
    container.innerHTML =
      '<p style="text-align:center;color:#888;">No messages yet. Say hi! 👋</p>';
    return;
  }
  container.innerHTML = "";
  messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `chat-msg ${msg.senderId === currentUser.uid ? "sent" : "received"}`;
    div.innerHTML = `<p>${msg.content}</p><span class="msg-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !activeChatId) return;

  input.value = "";

  try {
    await API.post("/messages", {
      conversationId: activeChatId,
      content: text,
    });
    // Reload messages
    const data = await API.get(`/messages/conversation/${activeChatId}`);
    renderMessages(data.messages || []);
  } catch (e) {
    toast("Failed to send.", "error");
  }
}

async function loadChatList() {
  const list = document.getElementById("chatListContainer");
  if (!list) return;
  list.innerHTML =
    '<p style="text-align:center;color:#888;">Loading chats...</p>';

  try {
    const data = await API.get("/messages/conversations");
    const convs = data.conversations || [];
    if (convs.length === 0) {
      list.innerHTML =
        '<p style="text-align:center;color:#888;">No conversations yet.</p>';
      return;
    }
    list.innerHTML = "";
    convs.forEach((c) => {
      const otherUser =
        c.participants?.find((p) => p._id !== currentUser.uid) || {};
      const div = document.createElement("div");
      div.className = "chat-list-item";
      div.onclick = () => openChatWith(otherUser._id, otherUser.name);
      div.innerHTML = `
        <div class="chat-avatar">${getInitials(otherUser.name)}</div>
        <div class="chat-info">
          <div class="chat-name">${otherUser.name || "Unknown"}</div>
          <div class="chat-preview">${c.lastMessage || "No messages"}</div>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (e) {
    list.innerHTML = '<p style="color:red;">Failed to load chats.</p>';
  }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [listings, requests] = await Promise.all([
      API.get("/listings/my"),
      API.get("/join-requests/received"),
    ]);

    const myListings = listings.listings || [];
    const myRequests = requests.requests || [];
    const pending = myRequests.filter((r) => r.status === "pending");

    document.getElementById("statMyListings").textContent = myListings.length;
    document.getElementById("statMyGroups").textContent = myListings.filter(
      (l) => l.type === "group",
    ).length;
    document.getElementById("statPendingRequests").textContent = pending.length;

    // Load first tab by default
    showDashTab("listings");
  } catch (e) {
    toast("Failed to load dashboard.", "error");
  }
}

function showDashTab(tab) {
  document
    .querySelectorAll(".dash-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.dash-tab[onclick*="${tab}"]`)
    ?.classList.add("active");

  document
    .querySelectorAll(".dash-content")
    .forEach((c) => c.classList.add("hidden"));
  document.getElementById(`dash-${tab}`)?.classList.remove("hidden");

  if (tab === "listings") loadMyListings();
  else if (tab === "groups") loadMyGroups();
  else if (tab === "received") loadReceivedRequests();
  else if (tab === "sent") loadSentRequests();
}

async function loadMyListings() {
  const container = document.getElementById("dash-listings");
  if (!container) return;
  container.innerHTML =
    '<p style="text-align:center;color:#888;">Loading...</p>';

  try {
    const data = await API.get("/listings/my");
    const listings = data.listings || [];
    if (listings.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;color:#888;">No listings yet.</p>';
      return;
    }
    container.innerHTML = "";
    listings.forEach((d) => {
      const div = document.createElement("div");
      div.className = "listing-card";
      div.innerHTML = `
        <div class="listing-type">${d.type === "match" ? "🚗 Match" : "🚌 Group"}</div>
        <div class="listing-route">${d.from} ➔ ${d.to}</div>
        <div class="listing-date">${d.date || "—"}</div>
        <button class="btn-small btn-danger" onclick="deleteListing('${d._id}')">Delete</button>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = '<p style="color:red;">Failed to load.</p>';
  }
}

async function loadMyGroups() {
  const container = document.getElementById("dash-groups");
  if (!container) return;
  container.innerHTML =
    '<p style="text-align:center;color:#888;">Loading...</p>';

  try {
    const data = await API.get("/listings/my?type=group");
    const groups = data.listings || [];
    if (groups.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;color:#888;">No groups created.</p>';
      return;
    }
    container.innerHTML = "";
    groups.forEach((g) => {
      const div = document.createElement("div");
      div.className = "group-manage-card";
      div.innerHTML = `
        <div class="group-info">
          <strong>${g.from} ➔ ${g.to}</strong>
          <span>👥 ${g.members?.length || 1}/${g.maxMembers || 4}</span>
        </div>
        <div class="group-actions">
          <button onclick="viewGroupMembers('${g._id}')">Members</button>
          <button class="btn-danger" onclick="deleteListing('${g._id}')">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = '<p style="color:red;">Failed to load.</p>';
  }
}

async function loadReceivedRequests() {
  const container = document.getElementById("dash-received");
  if (!container) return;
  container.innerHTML =
    '<p style="text-align:center;color:#888;">Loading...</p>';

  try {
    const data = await API.get("/join-requests/received");
    const requests = (data.requests || []).filter(
      (r) => r.status === "pending",
    );
    if (requests.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;color:#888;">No pending requests.</p>';
      return;
    }
    container.innerHTML = "";
    requests.forEach((r) => {
      const div = document.createElement("div");
      div.className = "request-card";
      div.innerHTML = `
        <div class="request-info">
          <strong>${r.senderName || "Someone"}</strong> wants to join your trip to <strong>${r.destination}</strong>
          ${r.message ? `<p class="request-msg">"${r.message}"</p>` : ""}
        </div>
        <div class="request-actions">
          <button class="btn-success" onclick="handleJoinRequest('${r._id}', '${r.groupId}', '${r.senderId}', 'accept')">Accept</button>
          <button class="btn-danger" onclick="handleJoinRequest('${r._id}', '${r.groupId}', '${r.senderId}', 'reject')">Reject</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = '<p style="color:red;">Failed to load.</p>';
  }
}

async function loadSentRequests() {
  const container = document.getElementById("dash-sent");
  if (!container) return;
  container.innerHTML =
    '<p style="text-align:center;color:#888;">Loading...</p>';

  try {
    const data = await API.get("/join-requests/sent");
    const requests = data.requests || [];
    if (requests.length === 0) {
      container.innerHTML =
        '<p style="text-align:center;color:#888;">No sent requests.</p>';
      return;
    }
    container.innerHTML = "";
    requests.forEach((r) => {
      const statusClass =
        r.status === "accepted"
          ? "status-accepted"
          : r.status === "rejected"
            ? "status-rejected"
            : "status-pending";
      const div = document.createElement("div");
      div.className = "request-card";
      div.innerHTML = `
        <div class="request-info">
          <span>Request to join trip to <strong>${r.destination}</strong></span>
          <span class="status-badge ${statusClass}">${r.status}</span>
        </div>
        ${r.status === "pending" ? `<button class="btn-small btn-outline" onclick="cancelJoinRequest('${r._id}')">Cancel</button>` : ""}
      `;
      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = '<p style="color:red;">Failed to load.</p>';
  }
}

async function handleJoinRequest(requestId, groupId, senderId, action) {
  try {
    await API.put(`/join-requests/${requestId}/${action}`);
    toast(
      action === "accept" ? "Request accepted! 🎉" : "Request rejected.",
      action === "accept" ? "success" : "info",
    );
    loadReceivedRequests();
    updateNotificationBadges();
  } catch (e) {
    toast("Failed to process request.", "error");
  }
}

async function cancelJoinRequest(requestId) {
  try {
    await API.delete(`/join-requests/${requestId}`);
    toast("Request cancelled.", "info");
    loadSentRequests();
  } catch (e) {
    toast("Failed to cancel.", "error");
  }
}

async function viewGroupMembers(groupId) {
  try {
    const data = await API.get(`/listings/${groupId}/members`);
    const members = data.members || [];

    let html = '<h3>Group Members</h3><div class="members-list">';
    members.forEach((m) => {
      html += `
        <div class="member-item">
          <div class="member-avatar">${getInitials(m.name)}</div>
          <span>${m.name}</span>
          ${m._id !== currentUser.uid ? `<button class="btn-small btn-danger" onclick="removeMember('${groupId}', '${m._id}')">Remove</button>` : '<span class="badge">You</span>'}
        </div>
      `;
    });
    html += "</div>";

    showAlert(html);
  } catch (e) {
    toast("Failed to load members.", "error");
  }
}

async function removeMember(groupId, memberId) {
  try {
    await API.delete(`/listings/${groupId}/members/${memberId}`);
    toast("Member removed.", "success");
    closeAlert();
    loadMyGroups();
  } catch (e) {
    toast("Failed to remove member.", "error");
  }
}

async function deleteListing(id) {
  if (!confirm("Delete this listing?")) return;
  try {
    await API.delete(`/listings/${id}`);
    toast("Deleted!", "success");
    loadMatches();
    loadGroups();
    loadDashboard();
  } catch (e) {
    toast("Failed to delete.", "error");
  }
}

// ── EXPERIENCE / RATINGS ──────────────────────────────────────────────────────
function resetExperiencePage() {
  const sel = document.getElementById("journeySelect");
  if (sel) sel.selectedIndex = 0;
  document
    .querySelectorAll("#experiencePage input, #experiencePage textarea")
    .forEach((e) => (e.value = ""));
}

async function ratePartner() {
  const journeyId = document.getElementById("journeySelect").value;
  const rating = document.getElementById("journeyRating").value;
  const comment = document.getElementById("journeyComment").value.trim();

  if (!journeyId) {
    toast("Select a journey.", "error");
    return;
  }
  if (!rating || rating < 1 || rating > 5) {
    toast("Give a rating 1-5.", "error");
    return;
  }

  try {
    await API.post("/ratings", {
      listingId: journeyId,
      rating: parseInt(rating),
      comment,
    });
    toast("Rating submitted! ⭐", "success");
    resetExperiencePage();
  } catch (e) {
    toast("Failed to submit rating.", "error");
  }
}

async function rateByEmail() {
  const email = document.getElementById("rateUserEmail").value.trim();
  const rating = document.getElementById("userRating").value;
  const comment = document.getElementById("userComment").value.trim();

  if (!email) {
    toast("Enter email.", "error");
    return;
  }
  if (!rating || rating < 1 || rating > 5) {
    toast("Give a rating 1-5.", "error");
    return;
  }

  try {
    await API.post("/ratings/by-email", {
      email,
      rating: parseInt(rating),
      comment,
    });
    toast("Rating submitted! ⭐", "success");
    document.getElementById("rateUserEmail").value = "";
    document.getElementById("userRating").value = "";
    document.getElementById("userComment").value = "";
  } catch (e) {
    toast(e.message || "Failed to submit.", "error");
  }
}

// ── REPORT ISSUE ──────────────────────────────────────────────────────────────
async function submitIssue() {
  const type = document.getElementById("issueType").value;
  const desc = document.getElementById("issueDesc").value.trim();

  if (!type || !desc) {
    toast("Fill all fields.", "error");
    return;
  }

  const btn = document.getElementById("submitIssueBtn");
  btn.textContent = "Submitting...";
  btn.disabled = true;

  try {
    await API.post("/issues", { type, description: desc });
    toast("Issue reported! We'll look into it. 🔧", "success");
    document.getElementById("issueType").value = "";
    document.getElementById("issueDesc").value = "";
  } catch (e) {
    toast("Failed to submit.", "error");
  } finally {
    btn.textContent = "Submit Issue";
    btn.disabled = false;
  }
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function loadSettingsPage() {
  const theme = localStorage.getItem("theme") || "ocean";
  document.getElementById("themeSelect").value = theme;
}

function changeTheme() {
  const theme = document.getElementById("themeSelect").value;
  document.body.className = theme;
  localStorage.setItem("theme", theme);
  toast("Theme changed! 🎨", "success");
}

// Apply saved theme on load
(function () {
  const theme = localStorage.getItem("theme") || "ocean";
  document.body.className = theme;
})();

// ── MODALS ────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}
function showAlert(html) {
  const modal = document.getElementById("alertModal");
  document.getElementById("alertContent").innerHTML = html;
  modal.classList.remove("hidden");
}
function closeAlert() {
  document.getElementById("alertModal").classList.add("hidden");
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSidebar();
    document
      .querySelectorAll(".modal:not(.hidden)")
      .forEach((m) => m.classList.add("hidden"));
  }
  if (
    e.key === "Enter" &&
    document.getElementById("chatConvPage").classList.contains("active")
  ) {
    sendChatMessage();
  }
});

// ── CHAT INPUT ENTER KEY ──────────────────────────────────────────────────────
document.getElementById("chatInput")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});
