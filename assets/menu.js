class Menu {
  constructor(menu) {
    this.menu = menu;

    this.selector = {
      checkbox: "input[type=checkbox]",
      header: ".header",
      menuContainer: ".menu__nav > .container",
      menuDropdown: ".menu__dropdown-wrapper",
      menuItem: ".menu__item",
      menuNav: ".menu__nav",
      menuOpener: "#mobile-menu-opener"
    }

    this.classes = {
      menuDropOpener: "menu__dropdown-opener",
      sticky: "header-sticky"
    }

    this.modifier = {
      active: "active",
      overflow: "overflow-hidden"
    }

    this.props = {
      fixed: 'fixed'
    }

    this.attr = {
      class: "class",
      style: "style",
      tag: "input",
      type: "checkbox"
    }

    this.cssVar = {
      menuHeight: "--menu-height"
    }

    this.resizeTimeout = null;
    this.transitionDelay = 0;
    this.screenWidth = 992;
  }

  init() {
    if (!this.menu) return false;

    this.elements();
    this.events();
  }

  elements() {
    this.doc = document.documentElement;
    this.header = this.menu.closest(this.selector.header);
    this.isSticky = this.header.classList.contains(this.classes.sticky);
    this.menuContainer = this.menu.querySelector(this.selector.menuContainer);
    this.menuDropdown = this.menu.querySelector(this.selector.menuDropdown);
    this.menuItems = this.menu.querySelectorAll(this.selector.menuItem);
    this.menuNav = this.menu.querySelector(this.selector.menuNav);
    this.menuOpener = this.menu.querySelector(this.selector.menuOpener);
    this.checkboxes = this.menuNav.querySelectorAll(this.selector.checkbox);
  }

  events() {
    this.menuHeight();

    document.addEventListener("click", this.openMenu.bind(this));
    document.addEventListener("click", this.closeMenuInnerDrops.bind(this));
    document.addEventListener("click", this.closeMenuOutside.bind(this));
    window.addEventListener("resize", this.debounceCalculatingMenuHeight.bind(this));
    window.addEventListener("resize", this.preventBlockingScrollingPage.bind(this));
  }

  // adding overflow:hidden when the menu opened
  openMenu(event) {
    const target = event.target.previousElementSibling

    if (!target || target !== this.menuOpener) return false

    if (this.menuOpener && !this.menuOpener.checked) this.stopScrolling()
  }

  closeMenu() {
    this.continueScrolling()
    this.closeAllMenuDrops(this.checkboxes)
    this.removeClass()
  }

  // prevent blocking scrolling the page when resizing the window
  preventBlockingScrollingPage() {
    if (!this.menuOpener.checked) return false

    window.innerWidth >= this.screenWidth ? this.continueScrolling() : this.stopScrolling()
  }

  // stop scrolling the page when menu is opened and the header is not sticky
  stopScrolling() {
    if (window.innerWidth >= this.screenWidth) return false

    if (this.isSticky) return false

    this.doc.classList.add(this.modifier.overflow)

    this.header.style.position = this.props.fixed
    this.scrollToTop(0, 0)
  }

  // continue scrolling the page when menu is closed
  continueScrolling() {
    if (this.isSticky) return false

    const classes = this.doc.classList;

    classes.length > 1
      ? this.doc.classList.remove(this.modifier.overflow)
      : this.doc.removeAttribute(this.attr.class)

    this.header.removeAttribute(this.attr.style)
  }

  // closing inner dropdowns when another dropdown is opened
  closeMenuInnerDrops(event) {
    if (window.innerWidth < this.screenWidth) return false

    const target = event.target,
          parent = target.parentElement;

    if (!target.classList.contains(this.classes.menuDropOpener)) return false

    if (!parent.classList.contains(this.modifier.active)) {
      const targetSiblings = this.getAllSiblings(target),
            parentSiblings = this.getAllSiblings(parent);

      targetSiblings.forEach(sibling => {
        const tag = sibling.tagName.toLowerCase(),
              type = sibling.type;

        let parentSiblingChildren = [];

        if (sibling && tag === this.attr.tag && type === this.attr.type) {
          parentSiblings.forEach(parentSibling => {
            const checkbox = parentSibling.querySelector(this.selector.checkbox)

            parentSiblingChildren.push(checkbox)
            parentSiblingChildren = parentSiblingChildren.filter(item => item !== null)
            parentSibling.classList.remove(this.modifier.active)
            this.closeAllMenuDrops(parentSiblingChildren)
          })
        }
      })

      parent.classList.add(this.modifier.active)
    } else {
      parent.classList.remove(this.modifier.active)
    }
  }

  // closing all dropdowns when closing the menu
  closeAllMenuDrops(elements) {
    if (!elements?.length) return false

    elements.forEach(element => element.checked = false)
  }

  // closing menu on click outside the block
  closeMenuOutside(event) {
    const target = event.target,
          parent = this.menu,
          element = this.selector.menuOpener.parentElement,
          menuOpened = this.menuOpener.checked;

    if (!target.closest(element) && !parent.contains(target) && menuOpened || target === this.menuOpener && !menuOpened) {
      this.menuOpener.checked = false
      this.closeMenu()

      if (window.innerWidth >= this.screenWidth) return false

      this.scrollToTop(0, 0, this.menuNav)
    }
  }

  // add a little delay to ensure layout is stable
  debounceCalculatingMenuHeight() {
    clearTimeout(this.resizeTimeout)
    this.resizeTimeout = setTimeout(this.menuHeight.bind(this), 200)
  }

  removeClass() {
    if (!this.checkboxes?.length) return false

    const delay = parseFloat(window.getComputedStyle(this.menuDropdown).transitionDuration) * 1000
    this.transitionDelay = delay

    setTimeout(this.menuItems.forEach(item => item.classList.remove(this.modifier.active)), delay)
  }

  scrollToTop(top, left, element = null) {
    const scrollOptions = {
      top: top,
      left: left,
      behavior: 'smooth'
    }

    if (element) {
      setTimeout(() => element.scrollTo(scrollOptions), this.transitionDelay)
    } else {
      window.scrollTo(scrollOptions)
    }
  }

  // get mobile menu height and set it as css variable
  menuHeight() {
    const height = this.menuContainer.getBoundingClientRect().height

    this.setCssVar(this.cssVar.menuHeight, height)
  }

  // get all siblings of the element
  getAllSiblings(element) {
    const parent = element.parentNode,
          children = [...parent.children];
    let siblings = [];

    children.forEach(child => {if (child !== element) siblings.push(child)})
    return siblings;
  }

  setCssVar(key, val) {
    this.doc.style.setProperty(
      `${key}`,
      `${val}px`
    )
  }
}

const initMenu = new Menu(document.querySelector('.menu'));

document.addEventListener("readystatechange", (e) => {
  if (e.target.readyState === "complete") initMenu.init();
})
