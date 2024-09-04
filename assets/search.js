class Search {
  constructor(search) {
    this.search = search;

    this.selector = {
      search: ".search-form",
      searchForm: "#search",
      searchOpener: "#search-opener",
      searchInput: ".search-form__input",
      searchReset: ".search-form__reset"
    }

    this.classes = {
      filled: "filled"
    }

    this.attr = {
      action: "action"
    }

    this.params = {
      q: "q"
    }

    this.url = new URL(window.location.href);
  }

  init() {
    if (!this.search) return false;

    this.elements();
    this.events();
  }

  elements() {
    this.searchForm = this.search.querySelector(this.selector.searchForm);
    this.searchOpener = this.search.querySelector(this.selector.searchOpener);
    this.searchInput = this.search.querySelector(this.selector.searchInput);
    this.searchReset = this.search.querySelector(this.selector.searchReset);
  }

  events() {
    this.searchAutoFill();

    document.addEventListener("click", this.searchOpen.bind(this));
    document.addEventListener("click", this.searchClear.bind(this));
    document.addEventListener("click", this.searchClose.bind(this));
    document.addEventListener("keyup", this.searchClearButton.bind(this));
    document.addEventListener("submit", this.searchHandleSubmit.bind(this));
  }

  // set focus to the input field when opening the search popup
  searchOpen(event) {
    const target = event.target;

    if (!target || target !== this.searchOpener) return false;

    setTimeout(() => {
      this.searchInput.focus()

      this.searchClearButton()
    }, 30);
  }

  // add/remove class to parent of search input field
  searchClearButton() {
    if (!this.searchInput) return false;

    this.searchInput.value.length !== 0
      ? this.searchInput.parentElement.classList.add(this.classes.filled)
      : this.searchInput.parentElement.classList.remove(this.classes.filled)
  }

  // clear input field
  searchClear(event) {
    const target = event.target;

    if (target !== this.searchReset) return false;

    this.searchInput.value = "";
    this.searchInput.parentElement.classList.remove(this.classes.filled);
    this.searchInput.focus();
  }

  // closing search popup on click outside
  searchClose(event) {
    const target = event.target,
          outside = target.closest(this.selector.search);

    if (outside !== null) return false

    this.searchOpener.checked = false;
  }

  // autofill search input field
  searchAutoFill() {
    const query = this.url.searchParams.get(this.params.q);

    if (!query) return false;

    this.searchInput.value = query;
  }

  searchHandleSubmit (e) {
    const target = e.target;

    if (target !== this.searchForm) return false;

    e.preventDefault();

    const value = this.searchInput.value,
          route = this.searchForm.getAttribute(this.attr.action);

    this.url.href = this.url.origin + route;
    this.url.searchParams.set(this.params.q, value);

    window.location.href = this.url.href;
  }
}

const initSearch = new Search(document.querySelector('.search-form'));

document.addEventListener("readystatechange", (e) => {
  if (e.target.readyState === "complete") initSearch.init();
})
