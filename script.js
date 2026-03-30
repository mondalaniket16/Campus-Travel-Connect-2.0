// ════════════════════════════════════════════════════════════════════════════
//  Campus Travel Connect — Main Script
// ════════════════════════════════════════════════════════════════════════════

const API_URL =
  window.API_URL || "https://campus-travel-connect-2-0.onrender.com/api";

let authToken = localStorage.getItem("authToken") || null;
let currentUser = null;
let currentUserData = null;
let viewingUserId = null;
let viewingUserData = null;
let activeConversationId = null;
let activeConversationUser = null;
let issueScreenshotFile = null;
let notificationPanelOpen = false;
let socket = null;
let unreadMessageCount = 0;

const state = {
  currentPage: "authPage",
  matchMode: "find",
  experienceTab: "journey",
  memberActionTab: "rate",
  ratings: {
    journey: 0,
    member: 0,
  },
};

const pageHistory = ["authPage"];

// Dynamic navbar state
let lastScrollTop = 0;
let navbarVisible = true;

const API = {
  async request(endpoint, options = {}) {
    const headers = {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const raw = await response.text();
      let data = {};

      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { message: raw };
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
        }

        throw new Error(
          data.error ||
            data.message ||
            `Request failed with status ${response.status}`,
        );
      }

      return data;
    } catch (error) {
      // Only show network errors for actual connection failures
      if (error.name === "TypeError" && error.message === "Failed to fetch") {
        throw new Error(
          "Unable to connect to the server. Please check your connection.",
        );
      }
      throw error;
    }
  },

  get(endpoint) {
    return API.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return API.request(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return API.request(endpoint, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return API.request(endpoint, { method: "DELETE" });
  },
};

function $(id) {
  return document.getElementById(id);
}

function toast(message, type = "info") {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3200);
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function setAvatar(el, name = "", photoURL = "") {
  if (!el) return;
  if (photoURL) {
    el.style.backgroundImage = `url(${photoURL.startsWith("http") ? photoURL : `${API_URL.replace("/api", "")}${photoURL}`})`;
    el.textContent = "";
    el.style.fontSize = "0";
  } else {
    el.style.backgroundImage = "";
    el.style.fontSize = "";
    el.textContent = getInitials(name);
  }
}

function renderEmptyState(container, message, icon = "✨") {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <span>${icon}</span>
      <p>${message}</p>
    </div>
  `;
}

function showInlineLoading(container, message = "Loading...") {
  if (!container) return;
  container.innerHTML = `<div class="chat-loading">${message}</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  Socket.io Real-Time Connection
// ════════════════════════════════════════════════════════════════════════════

function initializeSocket() {
  if (!currentUser || socket?.connected) return;
  
  const serverUrl = API_URL.replace('/api', '');
  console.log('[Socket.io] Connecting to:', serverUrl);
  
  socket = io(serverUrl, {
    auth: { token: authToken },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('[Socket.io] Connected:', socket.id);
    socket.emit('user_online', currentUser.uid);
  });

  socket.on('disconnect', () => {
    console.log('[Socket.io] Disconnected');
  });

  // Real-time new message notification
  socket.on('new_message', (data) => {
    console.log('[Socket.io] New message received:', data);
    
    // Show red dot on message icon
    unreadMessageCount++;
    updateMessageBadge();
    
    // If user is on messages page but not in that conversation, show badge
    if (state.currentPage === 'messagesPage' && data.conversationId !== activeConversationId) {
      toast(`New message from ${data.senderName || 'Someone'}`, 'info');
    }
    
    // If user is NOT on messages page at all, definitely show indicator
    if (state.currentPage !== 'messagesPage') {
      toast(`💬 New message from ${data.senderName || 'Someone'}`, 'info');
    }
  });

  // Real-time notification
  socket.on('new_notification', (notification) => {
    console.log('[Socket.io] New notification:', notification);
    updateNotificationBadges();
    toast(notification.title || 'New notification', 'info');
  });

  // Join conversation room when user opens a chat
  socket.on('conversation_joined', (conversationId) => {
    console.log('[Socket.io] Joined conversation:', conversationId);
  });
}

function updateMessageBadge() {
  const badge = $('msgBadge');
  if (!badge) return;
  
  if (unreadMessageCount > 0) {
    badge.textContent = unreadMessageCount > 99 ? '99+' : unreadMessageCount;
    badge.classList.remove('hidden');
    badge.classList.add('badge-pulse');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('badge-pulse');
  }
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  unreadMessageCount = 0;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user._id || user.id,
    name: user.name || "User",
    email: user.email || "",
    reg: user.reg || "",
    dept: user.dept || "",
    phone: user.phone || "",
    bio: user.bio || "",
    photoURL: user.photoURL || "",
    extraEmail: user.extraEmail || "",
    extraPhone: user.extraPhone || "",
  };
}

function normalizeListing(listing = {}) {
  const creator = listing.creator || {};
  return {
    ...listing,
    id: listing._id,
    uid: String(listing.uid || creator._id || ""),
    name: listing.name || creator.name || "Anonymous",
    photoURL: listing.photoURL || creator.photoURL || "",
    from: listing.from || "VIT Chennai",
    to: listing.to || "Unknown",
    date: listing.date || "",
    time: listing.time || "",
    vehicle: listing.vehicle || "Anything",
    gender: listing.gender || "No Preference",
    notes: listing.notes || "",
    maxMembers: listing.maxMembers || 4,
    members: Array.isArray(listing.members) ? listing.members : [],
    isActive: listing.isActive !== false,
  };
}

function setButtonLoading(button, loading, loadingText, defaultText) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? loadingText : defaultText;
}

function closeSidebar() {
  $("sidebar")?.classList.remove("open");
  $("sidebarBackdrop")?.classList.add("hidden");
}

function openSidebar() {
  $("sidebar")?.classList.add("open");
  $("sidebarBackdrop")?.classList.remove("hidden");
}

function switchPage(pageId, options = {}) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  if (!options.skipHistory) {
    if (pageHistory[pageHistory.length - 1] !== pageId) {
      pageHistory.push(pageId);
    }
  }

  state.currentPage = pageId;
  closeSidebar();

  const greeting = $("userGreeting");
  if (greeting) {
    greeting.classList.toggle("home-page", pageId === "casePage");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goBack(fallback = "casePage") {
  if (pageHistory.length > 1) {
    pageHistory.pop();
    switchPage(pageHistory[pageHistory.length - 1], { skipHistory: true });
    return;
  }
  switchPage(fallback);
}

function backToCases() {
  switchPage("casePage");
}

function handleUnauthorized() {
  authToken = null;
  currentUser = null;
  currentUserData = null;
  localStorage.removeItem("authToken");
  setHeader();
  switchPage("authPage");
}

function setHeader() {
  const userBar = $("userBar");
  if (!currentUser || !currentUserData) {
    userBar?.classList.add("hidden");
    return;
  }

  userBar?.classList.remove("hidden");

  const firstName =
    currentUserData.name?.split(" ")[0] ||
    currentUser.email?.split("@")[0] ||
    "Traveller";
  $("userGreeting").textContent = `👋 Hi ${firstName}`;
  $("sidebarUserName").textContent = currentUserData.name || "User";
  $("sidebarUserEmail").textContent = currentUser.email || "";
  setAvatar($("sidebarUserAvatar"), currentUserData.name, currentUserData.photoURL);
  setAvatar($("headerAvatar"), currentUserData.name, currentUserData.photoURL);
}

async function initAuth() {
  try {
    if (!authToken) {
      switchPage("authPage");
      return;
    }

    const data = await API.get("/auth/me");
    currentUser = {
      uid: data.user._id,
      email: data.user.email,
    };
    currentUserData = normalizeUser(data.user);
    setHeader();
    switchPage("casePage");
    updateNotificationBadges();
    initializeSocket(); // Initialize real-time connection
  } catch {
    handleUnauthorized();
  } finally {
    $("loadingScreen")?.classList.add("hidden");
  }
}

function showLogin() {
  $("loginForm")?.classList.remove("hidden");
  $("signupForm")?.classList.add("hidden");
  $("forgotPwForm")?.classList.add("hidden");
  $("loginTab")?.classList.add("active");
  $("signupTab")?.classList.remove("active");
}

function showSignup() {
  $("signupForm")?.classList.remove("hidden");
  $("loginForm")?.classList.add("hidden");
  $("forgotPwForm")?.classList.add("hidden");
  $("signupTab")?.classList.add("active");
  $("loginTab")?.classList.remove("active");
}

function showForgotPw() {
  $("forgotPwForm")?.classList.remove("hidden");
  $("loginForm")?.classList.add("hidden");
  $("signupForm")?.classList.add("hidden");
  $("signupTab")?.classList.remove("active");
  $("loginTab")?.classList.remove("active");
}

async function signup() {
  const name = $("signupName").value.trim();
  const reg = $("signupReg").value.trim();
  const phone = $("signupPhone").value.trim();
  const email = $("signupEmail").value.trim().toLowerCase();
  const password = $("signupPassword").value;
  const confirmPassword = $("signupConfirmPassword").value;

  if (!name || !reg || !phone || !email || !password || !confirmPassword) {
    toast("Fill all sign up fields.", "error");
    return;
  }

  if (!email.endsWith("@vitstudent.ac.in")) {
    toast("Use your VIT student email only.", "error");
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    toast("Enter a valid 10-digit phone number.", "error");
    return;
  }

  if (password.length < 6) {
    toast("Password must be at least 6 characters.", "error");
    return;
  }

  if (password !== confirmPassword) {
    toast("Passwords do not match.", "error");
    return;
  }

  const button = $("signupBtn");
  setButtonLoading(button, true, "Creating...", "Create Account");

  try {
    const data = await API.post("/auth/signup", {
      name,
      reg,
      phone,
      email,
      password,
    });

    authToken = data.token;
    localStorage.setItem("authToken", authToken);
    currentUser = { uid: data.user._id, email: data.user.email };
    currentUserData = normalizeUser(data.user);
    setHeader();
    switchPage("casePage");
    toast("Account created successfully.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false, "Creating...", "Create Account");
  }
}

async function login() {
  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  if (!email || !password) {
    toast("Enter email and password.", "error");
    return;
  }

  const button = $("loginBtn");
  setButtonLoading(button, true, "Logging in...", "Login");

  try {
    const data = await API.post("/auth/login", { email, password });
    authToken = data.token;
    localStorage.setItem("authToken", authToken);
    currentUser = { uid: data.user._id, email: data.user.email };
    currentUserData = normalizeUser(data.user);
    setHeader();
    switchPage("casePage");
    updateNotificationBadges();
    initializeSocket(); // Initialize socket connection
    toast("Logged in successfully.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false, "Logging in...", "Login");
  }
}

// Decode JWT payload (for Google credential)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

// Google Sign-In Implementation
function googleSignIn() {
  if (typeof google === 'undefined' || !window.GOOGLE_CLIENT_ID) {
    toast("Google Sign-In is not available. Please refresh the page.", "error");
    return;
  }

  google.accounts.id.initialize({
    client_id: window.GOOGLE_CLIENT_ID,
    callback: handleGoogleCallback
  });

  google.accounts.id.prompt(); // Show One Tap dialog
}

async function handleGoogleCallback(response) {
  try {
    console.log('[Google Sign-In] Received credential');
    
    // Decode JWT to extract user info
    const payload = decodeJWT(response.credential);
    if (!payload) {
      throw new Error("Invalid Google token");
    }

    const googleAuthData = {
      googleId: payload.sub || payload.jti,
      email: payload.email,
      name: payload.name,
      photoURL: payload.picture || ''
    };

    console.log('[Google Sign-In] Extracted data:', { email: googleAuthData.email, name: googleAuthData.name });
    
    const data = await API.post("/auth/google", googleAuthData);
    
    authToken = data.token;
    localStorage.setItem("authToken", authToken);
    currentUser = { uid: data.user._id, email: data.user.email };
    currentUserData = normalizeUser(data.user);
    setHeader();
    switchPage("casePage");
    updateNotificationBadges();
    initializeSocket();
    toast(`Welcome, ${data.user.name}!`, "success");
  } catch (error) {
    console.error('[Google Sign-In] Error:', error);
    toast(error.message || "Google Sign-In failed", "error");
  }
}

async function forgotPassword() {
  if (!$("forgotEmail").value.trim()) {
    toast("Enter your email.", "error");
    return;
  }
  toast("Password reset is not enabled yet. Please contact support.", "info");
  showLogin();
}

function logout() {
  disconnectSocket(); // Disconnect socket before logout
  authToken = null;
  currentUser = null;
  currentUserData = null;
  localStorage.removeItem("authToken");
  setHeader();
  switchPage("authPage");
  toast("Logged out successfully.", "info");
}

function goHome() {
  backToCases();
}

async function goDashboard() {
  switchPage("dashboardPage");
  await loadDashboard();
}

async function goMyProfile() {
  switchPage("profilePage");
  await loadMyProfile();
}

async function goMessages() {
  switchPage("chatListPage");
  await loadChatList();
}

function goFindMatch() {
  openMatchPage();
}

function goGroupFinder() {
  openRoutePage();
}

function goExperience() {
  switchPage("experiencePage");
  showExpTab("journey");
  loadJourneyOptions();
}

function goSettings() {
  switchPage("settingsPage");
  loadSettingsPage();
}

function goReportIssue() {
  switchPage("reportIssuePage");
}

function openMatchPage() {
  switchPage("matchPage");
  showFindForm();
}

function openRoutePage() {
  switchPage("routePage");
}

function showFindForm() {
  state.matchMode = "find";
  $("findForm")?.classList.remove("hidden");
  $("postForm")?.classList.add("hidden");
  $("findTab")?.classList.add("active");
  $("postTab")?.classList.remove("active");
}

function showPostForm() {
  state.matchMode = "post";
  $("postForm")?.classList.remove("hidden");
  $("findForm")?.classList.add("hidden");
  $("postTab")?.classList.add("active");
  $("findTab")?.classList.remove("active");
}

function handleOtherInput(selectEl, inputId) {
  const target = $(inputId);
  if (!target || !selectEl) return;
  const show = selectEl.value === "other";
  target.classList.toggle("hidden", !show);
  if (!show) target.value = "";
}

function getSelectedValue(selectId, otherInputId) {
  const select = $(selectId);
  const other = otherInputId ? $(otherInputId) : null;
  if (!select) return "";
  return select.value === "other" ? other?.value.trim() || "" : select.value.trim();
}

async function searchMatches() {
  const destination = getSelectedValue("destinationSelect", "destinationOther");
  const date = $("matchDate").value;
  const transport = getSelectedValue("transportSelect", "transportOther");
  const gender = $("genderSelect").value;
  const button = $("searchMatchBtn");
  const resultsSection = $("matchResultsSection");
  const results = $("matchResults");

  setButtonLoading(button, true, "Searching...", "🔍 Search");
  resultsSection?.classList.remove("hidden");
  showInlineLoading(results, "Finding travel matches...");

  try {
    const query = new URLSearchParams({ type: "match" });
    if (destination && !/select/i.test(destination)) {
      query.append("destination", destination);
    }
    if (date) query.append("date", date);
    if (transport && !/select/i.test(transport)) {
      query.append("transport", transport);
    }
    if (gender && !/select/i.test(gender)) {
      query.append("gender", gender);
    }

    const data = await API.get(`/listings?${query.toString()}`);
    const listings = (data.listings || []).map(normalizeListing);

    if (!listings.length) {
      renderEmptyState(results, "No matches found. Try adjusting your filters or post your own trip!", "🚕");
      return;
    }

    results.innerHTML = listings
      .map(
        (listing) => {
          // Safely extract user ID
          const userId = listing.uid || (listing.creator && listing.creator._id) || listing.creator;
          const safeUserId = typeof userId === 'object' ? (userId._id || userId.id) : userId;
          
          return `
        <div class="result-card">
          <div class="result-avatar" onclick="openUserProfile('${safeUserId}')">${getInitials(listing.name)}</div>
          <div class="result-info">
            <h3>${listing.name}</h3>
            <p><strong>${listing.from}</strong> → <strong>${listing.to}</strong></p>
            <p>${listing.date || "Flexible date"} · ${listing.time || "Flexible time"} · ${listing.vehicle}</p>
            <div class="group-meta">
              <span class="badge">${listing.type === "match" ? "Match" : "Group"}</span>
              <span class="badge gender-badge">${listing.gender}</span>
            </div>
            ${listing.notes ? `<p class="extra-info">${listing.notes}</p>` : ""}
          </div>
          ${
            currentUser && String(safeUserId) !== String(currentUser.uid)
              ? `<button class="connect-btn" onclick="messageUserFromListing('${safeUserId}', '${listing.name.replace(/'/g, "\\'")}')">Message</button>`
              : `<span class="badge">Your trip</span>`
          }
        </div>
      `;
        }
      )
      .join("");
  } catch (error) {
    renderEmptyState(results, error.message || "Failed to search. Please try again.", "⚠️");
  } finally {
    setButtonLoading(button, false, "Searching...", "🔍 Search");
  }
}

async function postMyTrip() {
  if (!currentUser) {
    toast("Login required.", "error");
    return;
  }

  const to = getSelectedValue("postDestSelect", "postDestOther");
  const date = $("postDate").value;
  const time = $("postTime").value;
  const vehicle = $("postTransport").value;
  const gender = $("postGender").value;
  const notes = $("postExtraInfo").value.trim();

  if (!to || !date || !time || /select/i.test(to) || /select/i.test(vehicle)) {
    toast("Fill destination, date, time and transport.", "error");
    return;
  }

  const button = $("postTripBtn");
  setButtonLoading(button, true, "Posting...", "📮 Post My Trip");

  try {
    const result = await API.post("/listings", {
      type: "match",
      from: "VIT Chennai",
      to,
      date,
      time,
      vehicle,
      gender: gender === "Select Gender Preference" ? "No Preference" : gender,
      notes,
    });

    // Success - reset form and show results
    toast("Trip posted successfully!", "success");
    $("postExtraInfo").value = "";
    $("postDate").value = "";
    $("postTime").value = "";
    $("postTransport").selectedIndex = 0;
    $("postGender").selectedIndex = 0;
    $("postDestSelect").selectedIndex = 0;
    $("postDestOther").value = "";
    $("postDestOther").classList.add("hidden");
    showFindForm();
    searchMatches();
  } catch (error) {
    toast(error.message || "Failed to post trip", "error");
  } finally {
    setButtonLoading(button, false, "Posting...", "📮 Post My Trip");
  }
}

async function searchGroups() {
  const destination = getSelectedValue("routeToSelect", "routeToOther");
  const date = $("routeDate").value;
  const mode = $("routeMode").value;
  const gender = $("routeGender").value;
  const resultsSection = $("routeResultsSection");
  const results = $("routeResults");
  const button = $("searchGroupBtn");

  setButtonLoading(button, true, "Searching...", "🔍 Search Groups");
  resultsSection?.classList.remove("hidden");
  showInlineLoading(results, "Searching groups...");

  try {
    const query = new URLSearchParams({ type: "group" });
    if (destination && !/select/i.test(destination) && destination !== "") {
      query.append("destination", destination);
    }
    if (date) query.append("date", date);
    if (mode && mode !== "" && !/select/i.test(mode)) {
      query.append("transport", mode);
    }
    if (gender && !/select/i.test(gender)) query.append("gender", gender);

    console.log('[searchGroups] Query params:', Object.fromEntries(query.entries()));
    console.log('[searchGroups] Calling:', `/listings?${query.toString()}`);

    const data = await API.get(`/listings?${query.toString()}`);
    
    console.log('[searchGroups] Response:', data);
    console.log('[searchGroups] Found', data.listings?.length || 0, 'listings');
    
    const listings = (data.listings || []).map(normalizeListing);

    if (!listings.length) {
      renderEmptyState(results, "No groups found. Try different filters or create your own group!", "🧳");
      return;
    }

    results.innerHTML = listings
      .map((listing) => {
        const ownerId = listing.uid || (listing.creator && listing.creator._id) || listing.creator;
        const isOwner = currentUser && String(ownerId) === String(currentUser.uid);
        const isMember =
          currentUser &&
          listing.members && listing.members.length > 0 &&
          listing.members.some((member) => {
            const memberId = member._id || member;
            return String(memberId) === String(currentUser.uid);
          });
        const isFull = listing.members && listing.members.length >= (listing.maxMembers || 4);

        return `
          <div class="result-card group-card">
            <div class="result-info">
              <h3>${listing.name || "Travel Group"}</h3>
              <div class="group-route">
                <span class="route-from">${listing.from || "VIT Chennai"}</span>
                <span class="route-arrow">→</span>
                <span class="route-to">${listing.to || "Destination"}</span>
              </div>
              <p>${listing.date || "Flexible"} · ${listing.vehicle || listing.mode || "Flexible mode"}</p>
              <div class="group-meta">
                <span class="badge member-badge">${(listing.members || []).length}/${listing.maxMembers || 4} members</span>
                <span class="badge">${listing.gender || "Any"}</span>
              </div>
              ${listing.notes || listing.extraInfo ? `<p class="extra-info">${listing.notes || listing.extraInfo}</p>` : ""}
            </div>
            <div class="group-actions">
              ${
                isOwner
                  ? `<button class="delete-btn" onclick="deleteListing('${listing._id || listing.id}')">Delete</button>`
                  : isMember
                    ? `<span class="badge">Joined</span>`
                    : isFull
                      ? `<span class="badge">Group Full</span>`
                      : `<button class="connect-btn" onclick="requestJoinGroup('${listing._id || listing.id}')">Request to Join</button>`
              }
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    renderEmptyState(results, error.message || "Failed to search groups", "⚠️");
  } finally {
    setButtonLoading(button, false, "Searching...", "🔍 Search Groups");
  }
}

async function submitCreateGroup() {
  if (!currentUser) {
    toast("Login required.", "error");
    return;
  }

  const to = getSelectedValue("cgToSelect", "cgToOther");
  const date = $("cgDate").value;
  const mode = $("cgMode").value;
  const gender = $("cgGender").value;
  const maxMembers = parseInt($("cgMax").value, 10);
  const notes = $("cgExtraInfo").value.trim();

  if (!to || !date || !mode || !maxMembers) {
    toast("Fill all required group details.", "error");
    return;
  }

  const button = $("createGroupBtn");
  setButtonLoading(button, true, "Creating...", "Create Group 🎒");

  try {
    const result = await API.post("/listings", {
      type: "group",
      from: "VIT Chennai",
      to,
      date,
      vehicle: mode,
      gender,
      maxMembers,
      notes,
    });

    // Success - clear form and navigate
    toast("Group created successfully!", "success");
    
    // Reset form fields
    $("cgDate").value = "";
    $("cgMode").selectedIndex = 0;
    $("cgGender").selectedIndex = 0;
    $("cgMax").value = "";
    $("cgExtraInfo").value = "";
    $("cgToSelect").selectedIndex = 0;
    $("cgToOther").value = "";
    $("cgToOther").classList.add("hidden");
    
    // Navigate and refresh
    switchPage("routePage");
    searchGroups();
  } catch (error) {
    toast(error.message || "Failed to create group", "error");
  } finally {
    setButtonLoading(button, false, "Creating...", "Create Group 🎒");
  }
}

async function requestJoinGroup(groupId) {
  try {
    console.log('[requestJoinGroup] Attempting to join group:', groupId);
    
    await API.post("/join-requests", { groupId });
    toast("Join request sent successfully!", "success");
    updateNotificationBadges();
    await searchGroups();
  } catch (error) {
    console.error('[requestJoinGroup] Error:', error);
    
    const errorMessage = error.message || 'Failed to send request';
    
    // Handle specific error cases with user-friendly messages
    if (errorMessage.includes('already sent') || errorMessage.includes('already have')) {
      toast("You have already sent a request to this group.", "info");
    } else if (errorMessage.includes('already a member')) {
      toast("You are already a member of this group.", "info");
    } else if (errorMessage.includes('Group is full')) {
      toast("This group is full and cannot accept more members.", "info");
    } else if (errorMessage.includes('Group not found')) {
      toast("This group no longer exists.", "error");
    } else {
      toast(errorMessage, "error");
    }
  }
}

async function deleteListing(id) {
  if (!confirm("Delete this listing?")) return;
  try {
    await API.delete(`/listings/${id}`);
    toast("Listing deleted.", "success");
    await Promise.allSettled([searchMatches(), searchGroups(), loadDashboard()]);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadMyProfile() {
  const form = $("profilePage");
  if (!form) return;

  try {
    const data = await API.get("/users/me");
    currentUserData = normalizeUser(data.user);
    setHeader();

    setAvatar($("profileAvatar"), currentUserData.name, currentUserData.photoURL);
    $("profileName").value = currentUserData.name;
    $("profileReg").value = currentUserData.reg;
    $("profileDept").value = currentUserData.dept;
    $("profilePhone").value = currentUserData.phone;
    $("profileExtraEmail").value = currentUserData.extraEmail;
    $("profileExtraPhone").value = currentUserData.extraPhone;
    $("profileEmail").value = currentUserData.email || currentUser.email || "";
    $("profileBio").value = currentUserData.bio;
  } catch (error) {
    toast(error.message, "error");
  }
}

async function saveProfile() {
  const button = $("saveProfileBtn");
  const payload = {
    name: $("profileName").value.trim(),
    dept: $("profileDept").value.trim(),
    phone: $("profilePhone").value.trim(),
    extraEmail: $("profileExtraEmail").value.trim(),
    extraPhone: $("profileExtraPhone").value.trim(),
    bio: $("profileBio").value.trim(),
  };

  if (!payload.name) {
    toast("Name is required.", "error");
    return;
  }

  setButtonLoading(button, true, "Saving...", "Save Changes");

  try {
    const data = await API.put("/users/me", payload);
    currentUserData = normalizeUser(data.user);
    setHeader();
    toast("Profile updated.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false, "Saving...", "Save Changes");
  }
}

function triggerPhotoUpload() {
  $("photoFileInput")?.click();
}

async function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    toast("Image must be under 5MB.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("photo", file);

  try {
    const data = await API.post(`/users/${currentUser.uid}/photo`, formData);
    currentUserData = normalizeUser(data.user);
    setAvatar($("profileAvatar"), currentUserData.name, currentUserData.photoURL);
    setHeader();
    toast("Profile photo updated.", "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function openUserProfile(userId) {
  try {
    const data = await API.get(`/users/${userId}`);
    viewingUserId = userId;
    viewingUserData = normalizeUser(data.user);

    setAvatar(
      $("otherProfileAvatar"),
      viewingUserData.name,
      viewingUserData.photoURL,
    );
    $("otherProfileName").textContent = viewingUserData.name;
    $("otherProfileReg").textContent = viewingUserData.reg || "No registration number";
    $("otherProfilePhone").textContent =
      viewingUserData.phone || "Phone not shared";
    $("otherProfileBio").textContent =
      viewingUserData.bio || "No bio added yet.";

    switchPage("otherProfilePage");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function messageUser() {
  if (!viewingUserId || !viewingUserData) return;
  await openChatWith(viewingUserId, viewingUserData.name);
}

async function messageUserFromListing(userId, name) {
  console.log('[messageUserFromListing] Raw userId:', userId, 'type:', typeof userId);
  
  // Extract actual ID if userId is an object
  let actualUserId = userId;
  if (typeof userId === 'object' && userId !== null) {
    actualUserId = userId._id || userId.id || String(userId);
  }
  
  console.log('[messageUserFromListing] Extracted userId:', actualUserId);
  
  await openChatWith(actualUserId, name);
}

async function openChatWith(otherUserId, fallbackName = "User") {
  try {
    console.log('[openChatWith] Starting chat with userId:', otherUserId, 'type:', typeof otherUserId);
    
    // Ensure we have a valid user ID
    if (!otherUserId || otherUserId === 'undefined' || otherUserId === 'null') {
      throw new Error('Invalid user ID');
    }
    
    // Check if trying to message yourself
    if (String(otherUserId) === String(currentUser.uid)) {
      throw new Error('Cannot message yourself');
    }
    
    const data = await API.post(`/messages/start/${otherUserId}`, {});
    
    console.log('[openChatWith] Chat started successfully:', data);
    
    activeConversationId = data.conversationId;
    activeConversationUser = {
      id: otherUserId,
      name: data.otherUser?.name || fallbackName,
      photoURL: data.otherUser?.photoURL || "",
    };

    $("chatPartnerName").textContent = activeConversationUser.name;
    setAvatar(
      $("chatPartnerAvatar"),
      activeConversationUser.name,
      activeConversationUser.photoURL,
    );

    switchPage("chatConvPage");
    await loadConversation();
  } catch (error) {
    console.error('[openChatWith] Error:', error);
    toast(error.message || 'Failed to start conversation', "error");
  }
}

async function loadChatList() {
  const container = $("chatList");
  showInlineLoading(container, "Loading conversations...");

  try {
    const data = await API.get("/messages/conversations");
    const conversations = data.conversations || [];

    if (!conversations.length) {
      renderEmptyState(container, "No messages yet.", "💬");
      return;
    }

    container.innerHTML = conversations
      .map((conversation) => {
        const otherUser =
          (conversation.participants || []).find(
            (participant) => participant._id !== currentUser.uid,
          ) || {};

        return `
          <div class="chat-list-item" onclick="openChatWith('${otherUser._id}', '${(otherUser.name || "User").replace(/'/g, "\\'")}')">
            <div class="result-avatar small-avatar">${getInitials(otherUser.name || "U")}</div>
            <div class="chat-list-info">
              <strong>${otherUser.name || "Unknown User"}</strong>
              <p>${conversation.lastMessage || "Tap to start chatting"}</p>
            </div>
            ${
              conversation.lastMessageTime
                ? `<span class="badge">${new Date(conversation.lastMessageTime).toLocaleDateString()}</span>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  } catch (error) {
    renderEmptyState(container, error.message, "⚠️");
  }
}

async function loadConversation() {
  const container = $("chatMessages");
  if (!activeConversationId) {
    renderEmptyState(container, "No conversation selected.", "💬");
    return;
  }

  showInlineLoading(container, "Loading messages...");

  try {
    const data = await API.get(`/messages/conversation/${activeConversationId}`);
    const messages = data.messages || [];

    if (!messages.length) {
      renderEmptyState(container, "No messages yet. Start the conversation.", "👋");
      return;
    }

    container.innerHTML = messages
      .map((message) => {
        const mine = String(message.senderId) === String(currentUser.uid);
        return `
          <div class="msg-bubble ${mine ? "mine" : "theirs"}">
            <span>${message.content}</span>
            <small>${new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
        `;
      })
      .join("");

    container.scrollTop = container.scrollHeight;
  } catch (error) {
    renderEmptyState(container, error.message, "⚠️");
  }
}

async function sendMessage() {
  const input = $("msgInput");
  const content = input.value.trim();

  if (!content || !activeConversationId) return;

  const sendBtn = document.querySelector(".send-btn");
  sendBtn.disabled = true;

  try {
    await API.post("/messages", {
      conversationId: activeConversationId,
      content,
    });

    input.value = "";
    await loadConversation();
    await loadChatList();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    sendBtn.disabled = false;
  }
}

function showDashTab(tab) {
  [
    ["dashListingsTab", "dashListingsContent"],
    ["dashGroupsTab", "dashGroupsContent"],
    ["dashRequestsTab", "dashRequestsContent"],
    ["dashSentTab", "dashSentContent"],
  ].forEach(([tabId, contentId]) => {
    $(tabId)?.classList.toggle(
      "active",
      tabId ===
        {
          listings: "dashListingsTab",
          groups: "dashGroupsTab",
          requests: "dashRequestsTab",
          sent: "dashSentTab",
        }[tab],
    );
    $(contentId)?.classList.toggle(
      "hidden",
      contentId !==
        {
          listings: "dashListingsContent",
          groups: "dashGroupsContent",
          requests: "dashRequestsContent",
          sent: "dashSentContent",
        }[tab],
    );
  });

  if (tab === "listings") loadMyListings();
  if (tab === "groups") loadMyGroups();
  if (tab === "requests") loadReceivedRequests();
  if (tab === "sent") loadSentRequests();
}

async function loadDashboard() {
  try {
    const [myListingsData, myRequestsData, ratingsData] = await Promise.all([
      API.get("/listings/my"),
      API.get("/join-requests/received"),
      API.get("/ratings/my"),
    ]);

    const myListings = (myListingsData.listings || []).map(normalizeListing);
    const requests = myRequestsData.requests || [];
    const ratings = ratingsData.ratings || [];

    $("statTrips").textContent = myListings.filter((item) => item.type === "match").length;
    $("statGroups").textContent = myListings.filter((item) => item.type === "group").length;
    $("statRatings").textContent = ratings.length;
    $("statPendingRequests").textContent = requests.filter(
      (request) => request.status === "pending",
    ).length;

    showDashTab("listings");
  } catch (error) {
    renderEmptyState(
      $("myListingsGrid"),
      error.message || "Failed to load dashboard.",
      "📊",
    );
    toast("Failed to load dashboard.", "error");
  }
}

async function loadMyListings() {
  const container = $("myListingsGrid");
  showInlineLoading(container, "Loading your listings...");

  try {
    const data = await API.get("/listings/my?type=match");
    const listings = (data.listings || []).map(normalizeListing);

    if (!listings.length) {
      renderEmptyState(container, "No trips posted yet.", "🚕");
      return;
    }

    container.innerHTML = listings
      .map(
        (listing) => `
        <div class="result-card">
          <div class="result-info">
            <h3>${listing.from} → ${listing.to}</h3>
            <p>${listing.date || "No date"} · ${listing.time || "No time"} · ${listing.vehicle}</p>
            ${listing.notes ? `<p class="extra-info">${listing.notes}</p>` : ""}
          </div>
          <button class="delete-btn" onclick="deleteListing('${listing.id}')">Delete</button>
        </div>
      `,
      )
      .join("");
  } catch (error) {
    renderEmptyState(container, error.message, "⚠️");
  }
}

async function loadMyGroups() {
  const container = $("myGroupsGrid");
  showInlineLoading(container, "Loading your groups...");

  try {
    // Fetch both created groups and groups where user is a member
    const [myData, allData] = await Promise.all([
      API.get("/listings/my?type=group"),
      API.get("/listings?type=group")
    ]);
    
    const myGroups = (myData.listings || []).map(normalizeListing);
    const allGroups = (allData.listings || []).map(normalizeListing);
    
    // Filter groups where current user is a member but not creator
    const joinedGroups = allGroups.filter(group => {
      const isMember = group.members && group.members.some(m => {
        const memberId = m._id || m;
        return String(memberId) === String(currentUser.uid);
      });
      const isCreator = String(group.uid) === String(currentUser.uid);
      return isMember && !isCreator;
    });
    
    // Combine both lists
    const groups = [...myGroups, ...joinedGroups];

    if (!groups.length) {
      renderEmptyState(container, "No groups yet. Create or join one!", "🎒");
      return;
    }

    container.innerHTML = groups
      .map(
        (group) => {
          const isCreator = String(group.uid) === String(currentUser.uid);
          return `
        <div class="result-card">
          <div class="result-info">
            <h3>${group.from} → ${group.to}</h3>
            <p>${group.date || "No date"} · ${group.vehicle} · ${(group.members || []).length}/${group.maxMembers} members</p>
            ${group.notes ? `<p class="extra-info">${group.notes}</p>` : ""}
            ${!isCreator ? '<span class="badge">Joined Group</span>' : '<span class="badge">Your Group</span>'}
          </div>
          <div class="group-actions">
            <button class="connect-btn" onclick="viewGroupMembers('${group.id}')">Members</button>
            ${isCreator ? `<button class="delete-btn" onclick="deleteListing('${group.id}')">Delete</button>` : ''}
          </div>
        </div>
      `;
        }
      )
      .join("");
  } catch (error) {
    renderEmptyState(container, error.message, "⚠️");
  }
}

async function loadReceivedRequests() {
  const container = $("receivedRequestsGrid");
  showInlineLoading(container, "Loading requests...");

  try {
    const data = await API.get("/join-requests/received");
    const requests = (data.requests || []).filter(
      (request) => request.status === "pending",
    );

    if (!requests.length) {
      renderEmptyState(container, "No requests yet.", "📩");
      return;
    }

    container.innerHTML = requests
      .map(
        (request) => `
        <div class="request-card">
          <div class="request-info">
            <h4>${request.senderName || "Student"} wants to join</h4>
            <p>Destination: ${request.destination || "Your trip"}</p>
            ${
              request.message
                ? `<div class="request-message">${request.message}</div>`
                : ""
            }
          </div>
          <div class="request-actions">
            <button class="accept-btn" onclick="handleJoinRequest('${request._id}', 'accept')">Accept</button>
            <button class="reject-btn" onclick="handleJoinRequest('${request._id}', 'reject')">Reject</button>
          </div>
        </div>
      `,
      )
      .join("");
  } catch (error) {
    renderEmptyState(container, error.message, "⚠️");
  }
}

async function loadSentRequests() {
  const container = $("sentRequestsGrid");
  showInlineLoading(container, "Loading your requests...");

  try {
    const data = await API.get("/join-requests/sent");
    const requests = data.requests || [];

    if (!requests.length) {
      renderEmptyState(container, "No requests sent yet.", "📤");
      return;
    }

    container.innerHTML = requests
      .map(
        (request) => `
        <div class="request-card">
          <div class="request-info">
            <h4>${request.destination || "Trip request"}</h4>
            <p>Status: <span class="status-badge status-${request.status}">${request.status}</span></p>
            ${
              request.message
                ? `<div class="request-message">${request.message}</div>`
                : ""
            }
          </div>
          <div class="request-actions">
            ${
              request.status === "pending"
                ? `<button class="reject-btn" onclick="cancelJoinRequest('${request._id}')">Cancel</button>`
                : ""
            }
          </div>
        </div>
      `,
      )
      .join("");
  } catch (error) {
    renderEmptyState(container, error.message, "⚠️");
  }
}

async function handleJoinRequest(requestId, action) {
  try {
    console.log(`[handleJoinRequest] ${action}ing request:`, requestId);
    
    await API.put(`/join-requests/${requestId}/${action}`, {});
    
    console.log(`[handleJoinRequest] Request ${action}ed successfully`);
    
    toast(`Request ${action}ed successfully.`, "success");
    
    // Reload all related data to show the updated group membership
    await Promise.allSettled([loadReceivedRequests(), loadMyGroups(), updateNotificationBadges()]);
    
    console.log('[handleJoinRequest] All data reloaded');
  } catch (error) {
    console.error('[handleJoinRequest] Error:', error);
    toast(error.message, "error");
  }
}

async function cancelJoinRequest(requestId) {
  try {
    await API.delete(`/join-requests/${requestId}`);
    toast("Request cancelled.", "success");
    await loadSentRequests();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function viewGroupMembers(groupId) {
  try {
    console.log('[viewGroupMembers] Fetching members for group:', groupId);
    
    const data = await API.get(`/listings/${groupId}/members`);
    const members = data.members || [];
    
    console.log('[viewGroupMembers] Received members:', members);
    
    if (!members.length) {
      toast("No members in this group yet.", "info");
      return;
    }

    // Create and show member details modal
    showMemberDetailsModal(members);
  } catch (error) {
    console.error('[viewGroupMembers] Error:', error);
    toast(error.message, "error");
  }
}

function showMemberDetailsModal(members) {
  // Remove existing modal if any
  const existing = document.getElementById('memberModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'memberModal';
  modal.className = 'member-modal';
  
  modal.innerHTML = `
    <div class="member-modal-backdrop" onclick="closeMemberModal()"></div>
    <div class="member-modal-content">
      <div class="member-modal-header">
        <h3>👥 Group Members (${members.length})</h3>
        <button class="modal-close-btn" onclick="closeMemberModal()">✕</button>
      </div>
      <div class="member-list">
        ${members.map(member => {
          // Get member ID - could be _id or id
          const memberId = member._id || member.id;
          const memberName = (member.name || 'User').replace(/'/g, "\\'");
          
          return `
          <div class="member-detail-card">
            <div class="member-avatar">${getInitials(member.name || 'U')}</div>
            <div class="member-info">
              <h4>${member.name || 'Unknown'}</h4>
              ${member.reg ? `<p class="member-detail"><strong>Reg No:</strong> ${member.reg}</p>` : ''}
              ${member.email ? `<p class="member-detail"><strong>Email:</strong> <a href="mailto:${member.email}">${member.email}</a></p>` : ''}
              ${member.phone ? `<p class="member-detail"><strong>Phone:</strong> <a href="tel:${member.phone}">${member.phone}</a></p>` : ''}
              ${member.dept ? `<p class="member-detail"><strong>Dept:</strong> ${member.dept}</p>` : ''}
            </div>
            ${memberId && memberId !== currentUser.uid ? 
              `<button class="message-member-btn" onclick="messageUserFromModal('${memberId}', '${memberName}')">💬</button>` :
              memberId === currentUser.uid ? 
              `<span class="badge" style="font-size: 12px;">You</span>` :
              ''
            }
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  // Trigger animation
  setTimeout(() => modal.classList.add('active'), 10);
}

function closeMemberModal() {
  const modal = document.getElementById('memberModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
}

async function messageUserFromModal(userId, name) {
  console.log('[messageUserFromModal] Called with:', { userId, name });
  
  // Validate userId before closing modal
  if (!userId || userId === 'undefined' || userId === 'null') {
    toast('Cannot start conversation: Invalid user ID', 'error');
    return;
  }
  
  closeMemberModal();
  await openChatWith(userId, name);
}

async function updateNotificationBadges() {
  if (!currentUser) return;
  try {
    const [requestsData, notifData] = await Promise.all([
      API.get("/join-requests/received"),
      API.get("/notifications").catch(() => ({ unreadCount: 0 }))
    ]);
    
    const pendingRequests = (requestsData.requests || []).filter(
      (request) => request.status === "pending",
    ).length;
    
    const totalUnread = pendingRequests + (notifData.unreadCount || 0);
    
    $("notifBadge").textContent = totalUnread;
    $("notifBadge").classList.toggle("hidden", totalUnread === 0);
  } catch {
    $("notifBadge")?.classList.add("hidden");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION PANEL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function toggleNotificationPanel(event) {
  event?.stopPropagation();
  if (notificationPanelOpen) {
    closeNotificationPanel();
  } else {
    openNotificationPanel();
  }
}

async function openNotificationPanel() {
  notificationPanelOpen = true;
  $("notificationPanel")?.classList.remove("hidden");
  $("notificationBackdrop")?.classList.remove("hidden");
  await loadNotifications();
}

function closeNotificationPanel() {
  notificationPanelOpen = false;
  $("notificationPanel")?.classList.add("hidden");
  $("notificationBackdrop")?.classList.add("hidden");
}

async function loadNotifications() {
  const container = $("notificationPanelBody");
  if (!container) return;
  
  showInlineLoading(container, "Loading notifications...");
  
  try {
    const [notifData, requestsData] = await Promise.all([
      API.get("/notifications").catch(() => ({ notifications: [] })),
      API.get("/join-requests/received")
    ]);
    
    const notifications = notifData.notifications || [];
    const pendingRequests = (requestsData.requests || []).filter(r => r.status === "pending");
    
    // Convert pending requests to notification format
    const requestNotifs = pendingRequests.map(req => ({
      _id: req._id,
      type: "join_request",
      title: "New Join Request",
      message: `${req.senderName || "Someone"} wants to join your trip to ${req.destination || "your group"}`,
      read: false,
      createdAt: req.createdAt,
      data: { requestId: req._id }
    }));
    
    const allNotifs = [...requestNotifs, ...notifications].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 30);
    
    if (!allNotifs.length) {
      container.innerHTML = `
        <div class="notification-empty">
          <span>🔔</span>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = allNotifs.map(notif => {
      const icon = getNotificationIcon(notif.type);
      const timeAgo = getTimeAgo(notif.createdAt);
      const unreadClass = notif.read ? "" : "unread";
      
      return `
        <div class="notification-item ${unreadClass}" onclick="handleNotificationClick('${notif._id}', '${notif.type}')">
          <div class="notification-icon">${icon}</div>
          <div class="notification-content">
            <h4>${notif.title}</h4>
            <p>${notif.message}</p>
          </div>
          <span class="notification-time">${timeAgo}</span>
        </div>
      `;
    }).join("");
    
  } catch (error) {
    container.innerHTML = `
      <div class="notification-empty">
        <span>⚠️</span>
        <p>${error.message || "Failed to load notifications"}</p>
      </div>
    `;
  }
}

function getNotificationIcon(type) {
  const icons = {
    join_request: "📩",
    request_accepted: "✅",
    request_rejected: "❌",
    new_message: "💬",
    group_update: "🎒"
  };
  return icons[type] || "🔔";
}

function getTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

async function handleNotificationClick(id, type) {
  closeNotificationPanel();
  
  if (type === "join_request") {
    await goDashboard();
    showDashTab("requests");
  } else if (type === "new_message") {
    await goMessages();
  } else if (type === "request_accepted" || type === "request_rejected") {
    await goDashboard();
    showDashTab("sent");
  } else {
    await goDashboard();
  }
  
  // Mark as read
  try {
    await API.put(`/notifications/${id}/read`, {});
    updateNotificationBadges();
  } catch {
    // Ignore errors for marking as read
  }
}

async function markAllNotificationsRead() {
  try {
    await API.put("/notifications/read-all", {});
    toast("All notifications marked as read", "success");
    await loadNotifications();
    await updateNotificationBadges();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadJourneyOptions() {
  const select = $("journeySelect");
  if (!select) return;

  select.innerHTML = '<option value="">Loading journeys...</option>';

  try {
    const data = await API.get("/listings/my-journeys");
    const journeys = (data.listings || []).map(normalizeListing);

    if (!journeys.length) {
      select.innerHTML = '<option value="">No journeys available yet</option>';
      return;
    }

    select.innerHTML =
      '<option value="">Select a journey...</option>' +
      journeys
        .map(
          (journey) =>
            `<option value="${journey.id}">${journey.date || "No date"} · ${journey.from} → ${journey.to}</option>`,
        )
        .join("");
  } catch (error) {
    select.innerHTML = `<option value="">${error.message}</option>`;
  }
}

function showExpTab(tab) {
  state.experienceTab = tab;
  $("expJourneyTab")?.classList.toggle("active", tab === "journey");
  $("expMemberTab")?.classList.toggle("active", tab === "member");
  $("expJourneyForm")?.classList.toggle("hidden", tab !== "journey");
  $("expMemberForm")?.classList.toggle("hidden", tab !== "member");
}

function showMemberSubTab(tab) {
  state.memberActionTab = tab;
  $("rateSubTab")?.classList.toggle("active", tab === "rate");
  $("reportSubTab")?.classList.toggle("active", tab === "report");
  $("memberRateForm")?.classList.toggle("hidden", tab !== "rate");
  $("memberReportForm")?.classList.toggle("hidden", tab !== "report");
}

function setStars(type, count) {
  state.ratings[type] = count;
  const containerId = type === "journey" ? "journeyStars" : "memberStars";
  const stars = $(`${containerId}`)?.querySelectorAll(".star") || [];
  stars.forEach((star, index) => {
    star.classList.toggle("active", index < count);
  });
}

async function submitJourneyRating() {
  const listingId = $("journeySelect").value;
  const rating = state.ratings.journey;
  const comment = $("journeyComment").value.trim();

  if (!listingId || !rating) {
    toast("Select a journey and give a rating.", "error");
    return;
  }

  try {
    await API.post("/ratings", { listingId, rating, comment });
    $("journeySelect").value = "";
    $("journeyComment").value = "";
    setStars("journey", 0);
    toast("Journey rating submitted.", "success");
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function lookupMember() {
  const email = $("memberLookupEmail").value.trim().toLowerCase();
  if (!email) {
    toast("Enter a member email.", "error");
    return;
  }

  try {
    const data = await API.get(`/users/search/email?email=${encodeURIComponent(email)}`);
    const user = normalizeUser(data.user);
    viewingUserData = user;
    viewingUserId = user.id;

    $("memberLookupResult").classList.remove("hidden");
    setAvatar($("memberFoundAvatar"), user.name, user.photoURL);
    $("memberFoundName").textContent = user.name;
    $("memberFoundReg").textContent = user.reg || "Registration unavailable";
    showMemberSubTab("rate");
  } catch (error) {
    $("memberLookupResult").classList.add("hidden");
    toast(error.message, "error");
  }
}

async function submitMemberRating() {
  const email = $("memberLookupEmail").value.trim().toLowerCase();
  const rating = state.ratings.member;
  const comment = $("memberRateComment").value.trim();

  if (!email || !rating) {
    toast("Find a member and choose a rating.", "error");
    return;
  }

  try {
    await API.post("/ratings/by-email", { email, rating, comment });
    $("memberRateComment").value = "";
    setStars("member", 0);
    toast("Member rating submitted.", "success");
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function submitMemberReport() {
  const reason = $("reportReason").value;
  const description = $("reportDescription").value.trim();

  if (!viewingUserId || !reason || !description) {
    toast("Complete member report details.", "error");
    return;
  }

  try {
    await API.post("/ratings/report", {
      toUser: viewingUserId,
      reason,
      description,
    });

    $("reportReason").selectedIndex = 0;
    $("reportDescription").value = "";
    toast("Member reported successfully.", "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

function applyTheme(theme) {
  document.body.classList.remove("theme-dark", "theme-light");
  if (theme === "dark") document.body.classList.add("theme-dark");
  if (theme === "light") document.body.classList.add("theme-light");

  localStorage.setItem("theme", theme);

  ["themeOptDefault", "themeOptDark", "themeOptLight"].forEach((id) =>
    $(id)?.classList.remove("selected-theme"),
  );

  if (theme === "dark") $("themeOptDark")?.classList.add("selected-theme");
  else if (theme === "light")
    $("themeOptLight")?.classList.add("selected-theme");
  else $("themeOptDefault")?.classList.add("selected-theme");

  toast("Theme updated.", "success");
}

function loadSettingsPage() {
  const theme = localStorage.getItem("theme") || "default";
  applyTheme(theme);
}

function handleScreenshotPreview(event) {
  const file = event.target.files?.[0];
  const preview = $("screenshotPreview");
  const hint = $("screenshotHint");

  if (!file) {
    issueScreenshotFile = null;
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    hint.textContent = "📎 Click to attach screenshot";
    return;
  }

  issueScreenshotFile = file;
  hint.textContent = `📎 ${file.name}`;

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

async function submitIssueReport() {
  const type = $("issueCategory").value;
  const description = $("issueDescription").value.trim();
  const button = $("submitIssueBtn");

  if (!type || !description) {
    toast("Fill issue category and description.", "error");
    return;
  }

  setButtonLoading(button, true, "Submitting...", "🚩 Submit Report");

  try {
    await API.post("/issues", { type, description });
    $("issueCategory").selectedIndex = 0;
    $("issueDescription").value = "";
    $("issueScreenshotInput").value = "";
    issueScreenshotFile = null;
    $("screenshotPreview").classList.add("hidden");
    $("screenshotHint").textContent = "📎 Click to attach screenshot";
    toast("Issue reported successfully.", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setButtonLoading(button, false, "Submitting...", "🚩 Submit Report");
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
    closeNotificationPanel();
  }
  if (
    event.key === "Enter" &&
    state.currentPage === "chatConvPage" &&
    document.activeElement?.id === "msgInput"
  ) {
    sendMessage();
  }
});

window.addEventListener("load", () => {
  loadSettingsPage();
  showLogin();
  initAuth();
  initDynamicNavbar();
});

// ══════════════════════════════════════════════════════════════════════
// DYNAMIC NAVBAR - Hide on scroll down, show on scroll up
// ══════════════════════════════════════════════════════════════════════
function initDynamicNavbar() {
  let lastScrollTop = 0;
  const navbar = document.getElementById('userBar');
  const scrollThreshold = 100; // Start hiding after 100px scroll
  
  window.addEventListener('scroll', () => {
    if (!navbar || navbar.classList.contains('hidden')) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Add scrolled class for background effect
    if (scrollTop > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    // Hide/show based on scroll direction
    if (scrollTop > scrollThreshold) {
      if (scrollTop > lastScrollTop && navbarVisible) {
        // Scrolling down - hide navbar
        navbar.classList.add('hidden-nav');
        navbarVisible = false;
      } else if (scrollTop < lastScrollTop && !navbarVisible) {
        // Scrolling up - show navbar
        navbar.classList.remove('hidden-nav');
        navbarVisible = true;
      }
    } else {
      // Near top - always show
      navbar.classList.remove('hidden-nav');
      navbarVisible = true;
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  }, { passive: true });
}
