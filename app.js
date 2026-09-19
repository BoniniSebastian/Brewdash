// =========================
// BREWDASH
// Firebase + dashboard logic
// =========================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// =========================
// FIREBASE
// =========================

const firebaseConfig = {
  apiKey: "AIzaSyAk-jIu4AoqOXEsc9QLJEYb_WRGs2OfGD4",
  authDomain: "brewdash-61e47.firebaseapp.com",
  projectId: "brewdash-61e47",
  storageBucket: "brewdash-61e47.firebasestorage.app",
  messagingSenderId: "387935264210",
  appId: "1:387935264210:web:c2bbba06ba4a2401e33c0b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// =========================
// CONSTANTS
// =========================

const DAYS = [
  { key: "mon", name: "MÅNDAG" },
  { key: "tue", name: "TISDAG" },
  { key: "wed", name: "ONSDAG" },
  { key: "thu", name: "TORSDAG" },
  { key: "fri", name: "FREDAG" },
  { key: "sat", name: "LÖRDAG" },
  { key: "sun", name: "SÖNDAG" }
];

let cards = [];
let settings = {};

// Håller reda på om användaren har tryckt PLANERA
// och väntar på att mobilen ska vridas till portrait.
let waitingForPlannerPortrait = false;


// =========================
// ELEMENTS
// =========================

const plannerOverlay =
  document.getElementById("plannerOverlay");

const plannerRotateOverlay =
  document.getElementById("plannerRotateOverlay");

const cardEditorOverlay =
  document.getElementById("cardEditorOverlay");

const manageOverlay =
  document.getElementById("manageOverlay");

const highlightsOverlay =
  document.getElementById("highlightsOverlay");

const cardForm =
  document.getElementById("cardForm");

const highlightsForm =
  document.getElementById("highlightsForm");


// =========================
// MOBILE / ORIENTATION
// =========================

function isMobilePhone() {
  return window.matchMedia(
    "(max-width: 700px), (max-height: 500px)"
  ).matches;
}


function isPortrait() {
  return window.matchMedia(
    "(orientation: portrait)"
  ).matches;
}


function isAnyEditorOpen() {
  return (
    !plannerOverlay.classList.contains("hidden") ||
    !cardEditorOverlay.classList.contains("hidden") ||
    !manageOverlay.classList.contains("hidden") ||
    !highlightsOverlay.classList.contains("hidden")
  );
}


function openPlannerMenu() {
  waitingForPlannerPortrait = false;

  plannerRotateOverlay.classList.add("hidden");

  plannerOverlay.classList.remove("hidden");

  document.body.classList.add("editor-open");
}


function closePlanningMode() {
  waitingForPlannerPortrait = false;

  plannerRotateOverlay.classList.add("hidden");
  plannerOverlay.classList.add("hidden");
  cardEditorOverlay.classList.add("hidden");
  manageOverlay.classList.add("hidden");
  highlightsOverlay.classList.add("hidden");

  document.body.classList.remove("editor-open");
}


function handleOrientationChange() {

  // Användaren har tryckt PLANERA i landscape
  // och har nu vridit telefonen till portrait.
  if (
    waitingForPlannerPortrait &&
    isPortrait()
  ) {
    openPlannerMenu();
    return;
  }

  // Om en editor redan är öppen behåller vi
  // planeringsläget även vid mindre viewportändringar.
  if (isAnyEditorOpen()) {
    document.body.classList.add("editor-open");
  }
}


window.addEventListener(
  "orientationchange",
  () => {
    setTimeout(handleOrientationChange, 150);
  }
);

window.addEventListener(
  "resize",
  handleOrientationChange
);


// =========================
// DATE / TIME
// =========================

function getMonday(date = new Date()) {
  const d = new Date(date);

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  return d;
}


function getISOWeek(date = new Date()) {
  const d = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
  );

  const dayNum = d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() + 4 - dayNum
  );

  const yearStart =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );

  return Math.ceil(
    (((d - yearStart) / 86400000) + 1) / 7
  );
}


function updateClock() {
  const now = new Date();

  const time =
    new Intl.DateTimeFormat("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);

  const date =
    new Intl.DateTimeFormat("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(now);

  document.getElementById(
    "currentTime"
  ).textContent = time;

  document.getElementById(
    "currentDate"
  ).textContent = date.toUpperCase();

  document.getElementById(
    "currentWeek"
  ).textContent =
    `VECKA ${getISOWeek(now)}`;
}


function renderWeekDates() {
  const monday = getMonday();
  const today = new Date();

  DAYS.forEach((day, index) => {
    const date = new Date(monday);

    date.setDate(
      monday.getDate() + index
    );

    const column =
      document.querySelector(
        `.day-column[data-day="${day.key}"]`
      );

    if (!column) return;

    const dateElement =
      column.querySelector(".day-date");

    dateElement.textContent =
      new Intl.DateTimeFormat("sv-SE", {
        day: "numeric",
        month: "short"
      })
        .format(date)
        .replace(".", "")
        .toUpperCase();

    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    column.classList.toggle(
      "today",
      isToday
    );
  });
}


updateClock();
renderWeekDates();

setInterval(updateClock, 1000);


// =========================
// FIRESTORE SETTINGS
// =========================

const settingsRef =
  doc(db, "Settings", "main");


onSnapshot(settingsRef, snapshot => {

  if (!snapshot.exists()) {
    createInitialSettings();
    return;
  }

  settings = snapshot.data();

  renderSettings();
});


async function createInitialSettings() {

  await setDoc(settingsRef, {
    highlight1: "",
    highlight2: "",
    highlight3: "",
    calendarUrl: ""
  });
}


function renderSettings() {

  const values = [
    settings.highlight1,
    settings.highlight2,
    settings.highlight3
  ];

  values.forEach((value, index) => {

    const el =
      document.getElementById(
        `highlight${index + 1}`
      );

    el.textContent =
      value?.trim()
        ? value
        : "Ingen information ännu";
  });


  const iframe =
    document.getElementById(
      "calendarIframe"
    );

  const placeholder =
    document.getElementById(
      "calendarPlaceholder"
    );


  if (settings.calendarUrl) {

    if (iframe.src !== settings.calendarUrl) {
      iframe.src = settings.calendarUrl;
    }

    iframe.style.display = "block";
    placeholder.style.display = "none";

  } else {

    iframe.style.display = "none";
    placeholder.style.display = "flex";
  }
}


// =========================
// FIRESTORE CARDS
// =========================

const cardsRef =
  collection(db, "cards");


onSnapshot(cardsRef, snapshot => {

  cards = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  cards.sort((a, b) => {

    const aOrder =
      typeof a.order === "number"
        ? a.order
        : 999999;

    const bOrder =
      typeof b.order === "number"
        ? b.order
        : 999999;

    return aOrder - bOrder;
  });

  renderCards();
  renderManageList();
});


// =========================
// DASHBOARD CARDS
// =========================

function renderCards() {

  document
    .querySelectorAll(".cards")
    .forEach(container => {
      container.innerHTML = "";
    });


  DAYS.forEach(day => {

    const container =
      document.querySelector(
        `.day-column[data-day="${day.key}"] .cards`
      );

    const dayCards =
      cards.filter(card =>
        card.active !== false &&
        Array.isArray(card.days) &&
        card.days.includes(day.key)
      );


    if (!dayCards.length) {

      const empty =
        document.createElement("div");

      empty.className = "empty-day";
      empty.textContent = "—";

      container.appendChild(empty);

      return;
    }


    dayCards.forEach(card => {

      const element =
        document.createElement("div");

      element.className = "task-card";

      element.textContent =
        card.text || "";

      container.appendChild(element);
    });
  });
}


// =========================
// OPEN / CLOSE PLANNER
// =========================

document
  .getElementById("openPlanner")
  .addEventListener("click", () => {

    // På telefon:
    // portrait -> öppna direkt.
    // landscape -> be användaren vrida telefonen.
    if (isMobilePhone()) {

      document.body.classList.add(
        "editor-open"
      );

      if (isPortrait()) {
        openPlannerMenu();
        return;
      }

      waitingForPlannerPortrait = true;

      plannerRotateOverlay.classList.remove(
        "hidden"
      );

      return;
    }

    // iPad / dator:
    // behåll nuvarande beteende.
    openPlannerMenu();
  });


document
  .getElementById("cancelPlannerRotate")
  .addEventListener("click", () => {

    waitingForPlannerPortrait = false;

    plannerRotateOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "editor-open"
    );
  });


document
  .getElementById("closePlanner")
  .addEventListener("click", closePlanner);


function closePlanner() {

  plannerOverlay.classList.add("hidden");

  waitingForPlannerPortrait = false;

  document.body.classList.remove(
    "editor-open"
  );
}


// =========================
// CREATE CARD
// =========================

document
  .getElementById("createCardButton")
  .addEventListener("click", () => {

    plannerOverlay.classList.add("hidden");

    resetCardForm();

    document.getElementById(
      "cardEditorTitle"
    ).textContent = "NYTT KORT";

    cardEditorOverlay.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "editor-open"
    );
  });


function resetCardForm() {

  cardForm.reset();

  document.getElementById(
    "editingCardId"
  ).value = "";
}


cardForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const text =
      document
        .getElementById("cardText")
        .value
        .trim();

    const selectedDays =
      Array.from(
        document.querySelectorAll(
          '.day-selector input:checked'
        )
      ).map(input => input.value);

    if (!text) {
      alert("Skriv något på kortet.");
      return;
    }

    if (!selectedDays.length) {
      alert("Välj minst en dag.");
      return;
    }


    const editingId =
      document.getElementById(
        "editingCardId"
      ).value;


    if (editingId) {

      await updateDoc(
        doc(db, "cards", editingId),
        {
          text,
          days: selectedDays,
          active: true,
          updatedAt: serverTimestamp()
        }
      );

    } else {

      await addDoc(cardsRef, {
        text,
        days: selectedDays,
        active: true,
        order: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }


    cardEditorOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "editor-open"
    );

    resetCardForm();
  }
);


// =========================
// CLOSE CARD EDITOR
// =========================

document
  .getElementById("closeCardEditor")
  .addEventListener("click", () => {

    cardEditorOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "editor-open"
    );

    resetCardForm();
  });


// =========================
// MANAGE CARDS
// =========================

document
  .getElementById("manageCardsButton")
  .addEventListener("click", () => {

    plannerOverlay.classList.add("hidden");

    renderManageList();

    manageOverlay.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "editor-open"
    );
  });


document
  .getElementById("closeManage")
  .addEventListener("click", () => {

    manageOverlay.classList.add("hidden");

    document.body.classList.remove(
      "editor-open"
    );
  });


function renderManageList() {

  const list =
    document.getElementById(
      "manageCardsList"
    );

  if (!list) return;

  list.innerHTML = "";


  DAYS.forEach(day => {

    const dayCards =
      cards.filter(card =>
        card.active !== false &&
        Array.isArray(card.days) &&
        card.days.includes(day.key)
      );

    if (!dayCards.length) return;


    const title =
      document.createElement("div");

    title.className =
      "manage-day-title";

    title.textContent =
      day.name;

    list.appendChild(title);


    dayCards.forEach(card => {

      list.appendChild(
        createManageCard(card)
      );
    });
  });


  const paused =
    cards.filter(card =>
      card.active === false
    );


  if (paused.length) {

    const title =
      document.createElement("div");

    title.className =
      "manage-day-title";

    title.textContent =
      "PAUSADE";

    list.appendChild(title);


    paused.forEach(card => {

      const element =
        createManageCard(card);

      element.classList.add(
        "paused"
      );

      list.appendChild(element);
    });
  }


  if (!cards.length) {

    const empty =
      document.createElement("div");

    empty.className =
      "empty-day";

    empty.textContent =
      "Inga kort skapade ännu.";

    list.appendChild(empty);
  }
}


// =========================
// MANAGE CARD ELEMENT
// =========================

function createManageCard(card) {

  const element =
    document.createElement("div");

  element.className =
    "manage-card";


  const text =
    document.createElement("div");

  text.className =
    "manage-card-text";

  text.textContent =
    card.text || "";


  const actions =
    document.createElement("div");

  actions.className =
    "manage-actions";


  const edit =
    document.createElement("button");

  edit.type = "button";
  edit.textContent = "ÄNDRA";

  edit.addEventListener(
    "click",
    () => editCard(card)
  );


  const pause =
    document.createElement("button");

  pause.type = "button";

  pause.textContent =
    card.active === false
      ? "AKTIVERA"
      : "PAUSA";

  pause.addEventListener(
    "click",
    () => togglePause(card)
  );


  const remove =
    document.createElement("button");

  remove.type = "button";
  remove.className = "delete";
  remove.textContent = "TA BORT";

  remove.addEventListener(
    "click",
    () => removeCard(card)
  );


  actions.append(
    edit,
    pause,
    remove
  );

  element.append(
    text,
    actions
  );

  return element;
}


// =========================
// EDIT CARD
// =========================

function editCard(card) {

  manageOverlay.classList.add(
    "hidden"
  );

  document.getElementById(
    "cardEditorTitle"
  ).textContent = "ÄNDRA KORT";


  document.getElementById(
    "editingCardId"
  ).value = card.id;


  document.getElementById(
    "cardText"
  ).value = card.text || "";


  document
    .querySelectorAll(
      ".day-selector input"
    )
    .forEach(input => {

      input.checked =
        Array.isArray(card.days) &&
        card.days.includes(input.value);
    });


  cardEditorOverlay.classList.remove(
    "hidden"
  );

  document.body.classList.add(
    "editor-open"
  );
}


// =========================
// PAUSE / ACTIVATE
// =========================

async function togglePause(card) {

  if (card.active === false) {

    editCard({
      ...card,
      active: true
    });

    return;
  }


  await updateDoc(
    doc(db, "cards", card.id),
    {
      active: false,
      updatedAt: serverTimestamp()
    }
  );
}


// =========================
// DELETE CARD
// =========================

async function removeCard(card) {

  const confirmed =
    confirm(
      `Ta bort "${card.text}"?`
    );

  if (!confirmed) return;


  await deleteDoc(
    doc(db, "cards", card.id)
  );
}


// =========================
// HIGHLIGHTS
// =========================

document
  .getElementById("editHighlightsButton")
  .addEventListener("click", () => {

    plannerOverlay.classList.add("hidden");


    document.getElementById(
      "highlightInput1"
    ).value =
      settings.highlight1 || "";


    document.getElementById(
      "highlightInput2"
    ).value =
      settings.highlight2 || "";


    document.getElementById(
      "highlightInput3"
    ).value =
      settings.highlight3 || "";


    highlightsOverlay.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "editor-open"
    );
  });


document
  .getElementById("closeHighlights")
  .addEventListener("click", () => {

    highlightsOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "editor-open"
    );
  });


highlightsForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const highlight1 =
      document.getElementById(
        "highlightInput1"
      ).value.trim();


    const highlight2 =
      document.getElementById(
        "highlightInput2"
      ).value.trim();


    const highlight3 =
      document.getElementById(
        "highlightInput3"
      ).value.trim();


    await setDoc(
      settingsRef,
      {
        ...settings,
        highlight1,
        highlight2,
        highlight3
      },
      {
        merge: true
      }
    );


    highlightsOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "editor-open"
    );
  }
);


// =========================
// CLOSE OVERLAYS BY
// CLICKING OUTSIDE
// =========================

[
  plannerOverlay,
  cardEditorOverlay,
  manageOverlay,
  highlightsOverlay
].forEach(overlay => {

  overlay.addEventListener(
    "click",
    event => {

      if (event.target !== overlay) {
        return;
      }

      overlay.classList.add(
        "hidden"
      );

      document.body.classList.remove(
        "editor-open"
      );
    }
  );
});


// =========================
// ROTATE OVERLAY:
// CLICK OUTSIDE = CANCEL
// =========================

plannerRotateOverlay.addEventListener(
  "click",
  event => {

    if (event.target !== plannerRotateOverlay) {
      return;
    }

    waitingForPlannerPortrait = false;

    plannerRotateOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "editor-open"
    );
  }
);


// =========================
// INITIAL ORIENTATION STATE
// =========================

handleOrientationChange();

/* =========================
   CALENDAR AUTO REFRESH
========================= */

setInterval(() => {
  const calendarIframe = document.getElementById("calendarIframe");

  if (calendarIframe && calendarIframe.src) {
    const currentSrc = calendarIframe.src;
    calendarIframe.src = currentSrc;
  }
}, 60000);
