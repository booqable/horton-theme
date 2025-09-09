class Main {
  constructor(body) {
    this.body = body;

    this.selector = {
      datePicker: "bq-date-picker",
      datePickerParent: ".date-picker__instance--bottom"
    }

    this.modifier = {
      loaded: "loaded"
    }

    this.cssVar = {
      datePickerHeight: '--date-picker-height'
    }
  }

  init() {
    if (!this.body) return false;

    this.elements();
    this.events();
  }

  elements() {
    this.datePicker = document.querySelector(this.selector.datePicker);
    this.datePickerParent = document.querySelector(this.selector.datePickerParent);
  }

  events() {
    this.setLoadedClass();
    setTimeout(() => this.getDatePickerHeight(), 100);

    window.addEventListener("resize", this.getDatePickerHeight.bind(this));
  }

  getDatePickerHeight() {
    if (!this.datePickerParent) return false;

    const datePickerHeight = parseInt(this.datePicker?.getBoundingClientRect().height);

    if (datePickerHeight) this.setCssVar(this.cssVar.datePickerHeight, datePickerHeight);
  }

  setCssVar(key, val) {
    document.documentElement.style.setProperty(
      `${key}`,
      `${val}px`
    )
  }

  // adding class after loading content
  setLoadedClass() {
    this.body.classList.add(this.modifier.loaded);
  }
}

const main = new Main(document.querySelector('body'));

document.addEventListener("readystatechange", (event) => {
  if (event.target.readyState === "complete") main.init();
})
