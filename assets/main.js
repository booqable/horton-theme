class Main {
  constructor(body) {
    this.body = body;

    this.modifier = {
      loaded: "loaded"
    }
  }

  init() {
    if (!this.body) return false;

    this.events();
  }

  events() {
    this.setLoadedClass();
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
