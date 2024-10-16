class SecondaryMenu {
  constructor(menu) {
    this.menu = menu;

    this.selector = {
      menuItem: ".menu-secondary__item"
    }

    this.classes = {
      dropdown: "has-dropdown"
    }

    this.modifier = {
      active: "active"
    }

    this.event = {
      mouseenter: "mouseenter",
      mouseleave: "mouseleave"
    }

    this.data = {
      timeoutDelay: "data-timeout-delay"
    }

    this.timeoutMap = new Map();
  }

  init() {
    if (!this.menu) return false;

    this.elements();
    this.events();
  }

  elements() {
    this.menuItems = [...this.menu.querySelectorAll(this.selector.menuItem)]
  }

  events() {
    this.menuCloseDelay();
  }

  menuCloseDelay() {
    if (!this.menuItems.length) return false;

    let timeDelay = this.menu.getAttribute(this.data.timeoutDelay);

    let defaultTimeout = !timeDelay || timeDelay < 0.5 ? 500 : timeDelay * 1000;

    const event = e => {
      const target = e.target,
            type = e.type,
            time = defaultTimeout;

      switch (type) {
        case this.event.mouseenter:
          if (this.timeoutMap.has(target)) {
            clearTimeout(this.timeoutMap.get(target));
            this.timeoutMap.delete(target);
          }
          target.classList.add(this.modifier.active);

          break;

        case this.event.mouseleave:
          const timeoutId = setTimeout(() => {
            target.classList.remove(this.modifier.active);
            this.timeoutMap.delete(target);
          }, time);

          this.timeoutMap.set(target, timeoutId);

          break;
      }
    };

    this.menuItems = this.menuItems.filter(item => item.classList.contains(this.classes.dropdown));
    this.menuItems.forEach((item) => {
      item.addEventListener(this.event.mouseenter, event);
      item.addEventListener(this.event.mouseleave, event);
    })
  }
}

const initSecondaryMenu = new SecondaryMenu(document.querySelector('.menu-secondary'));

document.addEventListener("readystatechange", (e) => {
  if (e.target.readyState === "complete") initSecondaryMenu.init();
})
