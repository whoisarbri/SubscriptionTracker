/* SubscriptionTracker: a dependency-free browser library for tracking renewals. */
(function (global) {
  "use strict";

  var FIELDS = ["service", "provider", "subscriber", "renewal", "category"];
  var LABELS = { service: "Service", provider: "Provider", subscriber: "Subscriber", renewal: "Renewal date", category: "Category" };

  function dateString(date) {
    var value = date || new Date();
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
  }

  function isExpired(renewal, today) {
    return renewal < (today || dateString());
  }

  function validate(data) {
    var errors = {};
    FIELDS.forEach(function (field) {
      if (!data[field] || !String(data[field]).trim()) errors[field] = LABELS[field] + " is required.";
    });
    return errors;
  }

  function formatDate(value) {
    var parts = value.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function createStore(key) {
    var items = [];
    var storage = null;
    try {
      storage = global.localStorage;
      var saved = storage.getItem(key);
      if (saved) items = JSON.parse(saved);
      if (!Array.isArray(items)) items = [];
    } catch (error) {
      console.warn("SubscriptionTracker could not load saved subscriptions.", error);
    }

    function save() {
      if (!storage) return;
      try { storage.setItem(key, JSON.stringify(items)); }
      catch (error) { console.warn("SubscriptionTracker could not save subscriptions.", error); }
    }

    return {
      all: function () { return items.slice(); },
      add: function (data) {
        var item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) };
        FIELDS.forEach(function (field) { item[field] = String(data[field]).trim(); });
        items.push(item);
        save();
        return item;
      },
      remove: function (id) { items = items.filter(function (item) { return item.id !== id; }); save(); },
      stats: function () { return { total: items.length, expired: items.filter(function (item) { return isExpired(item.renewal); }).length }; }
    };
  }

  function create(options) {
    var opts = options || {};
    var form = document.getElementById(opts.formId || "subscription-form");
    var tbody = document.getElementById(opts.rowsId || "subscription-rows");
    var total = document.getElementById(opts.totalId || "total-count");
    var expired = document.getElementById(opts.expiredId || "expired-count");
    var empty = document.getElementById(opts.emptyId || "empty-message");
    var listCount = document.getElementById(opts.listCountId || "list-count");
    var message = document.getElementById(opts.messageId || "live-message");
    var store = createStore(opts.storageKey || "subscription-tracker:v1");

    function textCell(text) { var cell = document.createElement("td"); cell.textContent = text; return cell; }
    function render() {
      var items = store.all().sort(function (a, b) { return a.renewal.localeCompare(b.renewal); });
      var stats = store.stats();
      tbody.innerHTML = "";
      items.forEach(function (item) {
        var row = document.createElement("tr");
        [item.service, item.provider, item.subscriber, formatDate(item.renewal), item.category].forEach(function (value) { row.appendChild(textCell(value)); });
        var status = document.createElement("td");
        var badge = document.createElement("span");
        badge.className = "st-badge " + (isExpired(item.renewal) ? "st-badge-expired" : "st-badge-active");
        badge.textContent = isExpired(item.renewal) ? "Expired" : "Active";
        status.appendChild(badge);
        row.appendChild(status);
        var action = document.createElement("td");
        var button = document.createElement("button");
        button.type = "button";
        button.className = "st-btn st-btn-danger";
        button.dataset.id = item.id;
        button.setAttribute("aria-label", "Delete " + item.service);
        button.textContent = "Delete";
        action.appendChild(button);
        row.appendChild(action);
        tbody.appendChild(row);
      });
      total.textContent = stats.total;
      expired.textContent = stats.expired;
      listCount.textContent = stats.total + (stats.total === 1 ? " item" : " items");
      empty.classList.toggle("st-hidden", items.length > 0);
    }

    function showErrors(errors) {
      FIELDS.forEach(function (field) {
        var input = form.elements[field];
        var error = form.querySelector('[data-error-for="' + field + '"]');
        error.textContent = errors[field] || "";
        input.classList.toggle("st-input-invalid", Boolean(errors[field]));
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = {};
      FIELDS.forEach(function (field) { data[field] = form.elements[field].value; });
      var errors = validate(data);
      showErrors(errors);
      if (Object.keys(errors).length) { form.elements[Object.keys(errors)[0]].focus(); return; }
      store.add(data);
      form.reset();
      message.textContent = data.service + " was added to your subscriptions.";
      render();
    });

    tbody.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-id]");
      if (!button) return;
      var service = button.getAttribute("aria-label").replace("Delete ", "");
      store.remove(button.dataset.id);
      message.textContent = service + " was removed.";
      render();
    });

    render();
    return { store: store, refresh: render };
  }

  global.SubscriptionTracker = { isExpired: isExpired, validate: validate, createStore: createStore, create: create };
  document.addEventListener("DOMContentLoaded", function () { create(); });
}(window));
