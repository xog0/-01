/* =====================================================================
   منطق الموقع — لا حاجة لتعديل هذا الملف في الاستخدام العادي
   ===================================================================== */
(function () {
  "use strict";

  /* أيقونة تظهر مكان صورة الصنف عندما لا توجد صورة */
  var PLACEHOLDER_ICON = '<svg class="ph-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="M9 5.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5Z"/><path d="M9 11c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5Z"/><path d="M9 16.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5S13.7 19 12 19s-3-1.1-3-2.5Z"/></svg>';

  var CFG = window.SITE_CONFIG, MENU = window.MENU_DATA, I18N = window.I18N;
  var lang = localStorage.getItem("lang") || "ar";
  var activeCat = "all";
  var query = "";

  var t = function (key) { return (I18N[lang] && I18N[lang][key]) || key; };
  var L = function (obj) { return obj ? (obj[lang] || obj.ar || obj.en || "") : ""; };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---------- روابط التواصل ---------- */
  function waLink(itemName) {
    var msg = itemName ? t("wa.item") + " " + itemName : t("wa.msg");
    return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(msg);
  }

  /* ---------- ترجمة الصفحة ---------- */
  function applyLang() {
    var html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = L(CFG.brand) + " | " + L(CFG.tagline);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-brand]").forEach(function (el) { el.textContent = L(CFG.brand); });
    document.querySelectorAll("[data-tagline]").forEach(function (el) { el.textContent = L(CFG.tagline); });
    document.querySelectorAll("[data-address]").forEach(function (el) { el.textContent = L(CFG.address); });

    document.querySelectorAll("[data-wa-link]").forEach(function (el) { el.href = waLink(); });
    document.querySelectorAll("[data-maps-link]").forEach(function (el) { el.href = CFG.mapsUrl; });
    document.querySelectorAll("[data-tel-link]").forEach(function (el) {
      el.href = "tel:" + CFG.phone;
      if (!el.hasAttribute("data-i18n")) el.textContent = CFG.phone;
    });
    document.querySelectorAll("[data-mail-link]").forEach(function (el) {
      el.href = "mailto:" + CFG.email;
      el.textContent = CFG.email;
    });

    localStorage.setItem("lang", lang);
    renderAll();
  }

  /* ---------- إحصائيات الواجهة ---------- */
  function renderStats() {
    var box = document.getElementById("heroStats");
    box.innerHTML = CFG.stats.map(function (s) {
      var v = lang === "ar" ? s.value : (s.valueEn || s.value);
      return "<li><b>" + esc(v) + "</b><span>" + esc(L(s.label)) + "</span></li>";
    }).join("");
  }

  /* ---------- تبويبات المنيو ---------- */
  function renderTabs() {
    var box = document.getElementById("menuTabs");
    var tabs = [{ id: "all", label: t("menu.all") }].concat(
      MENU.map(function (c) { return { id: c.id, label: L(c.name) }; })
    );
    box.innerHTML = tabs.map(function (tab) {
      return '<button class="tab' + (tab.id === activeCat ? " active" : "") +
        '" data-cat="' + tab.id + '">' + esc(tab.label) + "</button>";
    }).join("");
  }

  /* ---------- الأصناف ---------- */
  function matches(item) {
    if (!query) return true;
    var q = query.toLowerCase();
    return (L(item.name) + " " + L(item.desc)).toLowerCase().indexOf(q) > -1;
  }

  function itemHTML(item) {
    var name = L(item.name);
    var thumb = item.img
      ? '<img src="assets/img/' + esc(item.img) + '" alt="' + esc(name) + '" loading="lazy">'
      : PLACEHOLDER_ICON;
    var badge = item.badge
      ? '<span class="badge ' + item.badge + '">' + esc(t("badge." + item.badge)) + "</span>"
      : "";
    return '<article class="item">' +
      '<div class="item-thumb">' + thumb + "</div>" +
      '<div class="item-body">' +
        '<div class="item-top"><h4>' + esc(name) + "</h4>" +
        '<span class="price">' + esc(item.price) + " <small>" + esc(L(CFG.currency)) + "</small></span></div>" +
        '<p class="desc">' + esc(L(item.desc)) + "</p>" + badge +
      "</div></article>";
  }

  function renderMenu() {
    var wrap = document.getElementById("menuContainer");
    var empty = document.getElementById("menuEmpty");
    var cats = MENU.filter(function (c) { return activeCat === "all" || c.id === activeCat; });
    var html = "", found = 0;

    cats.forEach(function (cat) {
      var items = cat.items.filter(matches);
      if (!items.length) return;
      found += items.length;
      html += '<div class="cat-block reveal"><div class="cat-head"><h3>' + esc(L(cat.name)) +
        "</h3><span>" + esc(L(cat.note)) + '</span></div><div class="items">' +
        items.map(itemHTML).join("") + "</div></div>";
    });

    wrap.innerHTML = html;
    empty.hidden = found > 0;
    observeReveals();
  }

  /* ---------- المعرض ---------- */
  function renderGallery() {
    /* ضع أسماء صورك هنا بعد رفعها في assets/img/ — مثال: ["1.jpg","2.jpg", ...] */
    var photos = [];
    var grid = document.getElementById("galleryGrid");
    var cells = photos.length ? photos : [null, null, null, null, null, null];
    grid.innerHTML = cells.map(function (src) {
      var inner = src
        ? '<img src="assets/img/' + esc(src) + '" alt="" loading="lazy">'
        : PLACEHOLDER_ICON;
      return '<figure class="reveal">' + inner + "</figure>";
    }).join("");
  }

  /* ---------- الآراء ---------- */
  function renderReviews() {
    var grid = document.getElementById("reviewsGrid");
    grid.innerHTML = (window.TESTIMONIALS || []).map(function (r) {
      return '<blockquote class="review reveal"><div class="stars">★★★★★</div><p>' +
        esc(L(r.text)) + "</p><cite>" + esc(L(r.author)) + "</cite></blockquote>";
    }).join("");
  }

  /* ---------- التوصيل + الدوام + السوشيال ---------- */
  function renderDelivery() {
    document.getElementById("deliveryList").innerHTML = (CFG.delivery || []).map(function (d) {
      return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(L(d.name)) + "</a></li>";
    }).join("");
  }

  function renderHours() {
    document.getElementById("hoursList").innerHTML = (CFG.hours || []).map(function (h) {
      return '<div class="hours-row"><b>' + esc(L(h.day)) + "</b><span>" + esc(L(h.time)) + "</span></div>";
    }).join("");
  }

  function renderSocials() {
    var icons = { instagram: "IG", tiktok: "TT", snapchat: "SC", x: "X", facebook: "FB" };
    document.getElementById("socials").innerHTML = Object.keys(CFG.social || {}).map(function (k) {
      return '<li><a href="' + esc(CFG.social[k]) + '" target="_blank" rel="noopener" aria-label="' +
        k + '">' + (icons[k] || k) + "</a></li>";
    }).join("");
  }

  function renderAll() {
    renderStats(); renderTabs(); renderMenu(); renderGallery();
    renderReviews(); renderDelivery(); renderHours(); renderSocials();
  }

  /* ---------- الحركة عند التمرير ---------- */
  var io = null;
  function observeReveals() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: .12, rootMargin: "0px 0px -40px" });
    }
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) { io.observe(el); });
  }

  /* ---------- الأحداث ---------- */
  function bind() {
    document.getElementById("langBtn").addEventListener("click", function () {
      lang = lang === "ar" ? "en" : "ar";
      applyLang();
    });

    var burger = document.getElementById("burger");
    var nav = document.getElementById("nav");
    function setNav(open) {
      nav.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    }
    burger.addEventListener("click", function () { setNav(!nav.classList.contains("open")); });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") setNav(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.target) && !burger.contains(e.target)) setNav(false);
    });

    document.getElementById("menuTabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".tab");
      if (!btn) return;
      activeCat = btn.dataset.cat;
      renderTabs(); renderMenu();
    });

    var search = document.getElementById("menuSearch");
    var timer;
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { query = search.value.trim(); renderMenu(); }, 180);
    });

    var header = document.getElementById("header");
    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });

    window.addEventListener("scroll", function () {
      header.classList.toggle("scrolled", window.scrollY > 40);
      var pos = window.scrollY + 120, current = 0;
      sections.forEach(function (sec, i) { if (sec && sec.offsetTop <= pos) current = i; });
      links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
    }, { passive: true });
  }

  document.getElementById("year").textContent = new Date().getFullYear();
  bind();
  applyLang();
  observeReveals();
})();
