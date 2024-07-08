class Carousel {
  constructor(carousel) {
    this.carousel = carousel;

    this.selector = {
      navi: ".carousel__navigation",
      list: ".carousel__list",
      btn: ".carousel__btn",
      wrapper: ".carousel__wrapper",
      item: ".carousel__item",
      timer: ".carousel__timer"
    }

    this.classes = {
      pause: "carousel__pause",
      prev: "prev",
      next: "next",
      init: "initialized"
    }

    this.modifiers = {
      controls: "controls",
      hidden: "hidden"
    }

    this.event = {
      prev: "prev",
      next: "next",
      start: "touchstart",
      end: "touchend",
      enter: "mouseenter",
      leave: "mouseleave"
    }

    this.interval;
    this.infinite = true;
  }

  init() {
    if (!this.carousel) return false;

    this.elements();
    this.events();
  }

  elements() {
    this.wrap = this.carousel.querySelector(this.selector.wrapper);
    this.navi = this.carousel.querySelector(this.selector.navi);
    this.item = this.carousel.querySelector(this.selector.item);
    this.items = this.carousel.querySelectorAll(this.selector.item);
    this.btns = this.carousel.querySelectorAll(this.selector.btn);
    this.timers = this.carousel.querySelectorAll(this.selector.timer);
  }

  events() {
    this.carouselInit();
    this.startTimer();
    this.pauseAutoRotate();
    this.hideControls();

    this.btns.forEach(btn => {
      btn.addEventListener('click', this.navigation.bind(this))
    })
    window.addEventListener('resize', this.hideControls.bind(this))
  }

  carouselInit() {
    if (this.items.length < 2) return false
    this.carousel.classList.add(this.classes.init)
  }

  startTimer() {
    this.timers.forEach(timer => this.autoRotate(timer.value * 1000))
  }

  // autorotate slides of carousel
  autoRotate(time) {
    if (!time) return false;

    this.interval = setInterval(() => this.navigation(undefined, time), time);

    return () => clearInterval(this.interval);
  }

  // pause autorotate slides on hover and touch devices
  pauseAutoRotate() {
    const isPause = this.carousel.classList.contains(this.classes.pause);

    if (!isPause) return false;
    if (!this.items.length) return false;

    const func = event => {
      if (event.type === this.event.enter || event.type === this.event.start) clearInterval(this.interval);
      if (event.type === this.event.leave || event.type === this.event.end) this.startTimer();
    }

    this.carousel.addEventListener(this.event.enter, func);
    this.carousel.addEventListener(this.event.leave, func);
    this.carousel.addEventListener(this.event.start, func);
    this.carousel.addEventListener(this.event.end, func);
  }

  // slide the carousel left/right by clicking on the Prev/Next buttons
  navigation(event, time) {
    const target = event?.target,
          isPrev = target?.classList.contains(this.classes.prev),
          isNext = target?.classList.contains(this.classes.next);

    if (!isPrev && !isNext && !time) return false;

    const width = this.item.getBoundingClientRect().width,
          prev = this.event.prev,
          next = this.event.next;

    let element, left, scrollX, clientX, valueLeft = 0, trigger;

    element = isPrev || isNext
      ? this.getSiblingElement(target?.parentElement, this.selector.list, this.event.prev)
      : this.wrap

    left = element.scrollLeft;
    scrollX = element.scrollWidth;
    clientX = element.clientWidth;

    const slideOptions = {
      currentScroll: left,
      clientVal: clientX,
      scrollVal: scrollX,
      scrollToVal: valueLeft,
      size: width,
    }

    if (isPrev) trigger = prev
    if (isNext || time) trigger = next

    valueLeft = this.slideEffect(trigger, slideOptions);

    const scrollOptions = {
      element: element,
      left: valueLeft,
      top: 0
    }

    this.scrollTo(scrollOptions);
  }

  slideEffect(trigger, options) {
    const { currentScroll, scrollVal, clientVal, size } = options;
    let condition, scrollToLast, scrollToNext, scrollToVal;

    switch (trigger) {
      case this.event.prev:
        condition = currentScroll === 0;
        scrollToLast = scrollVal;
        scrollToNext = currentScroll - size;

        break;

      case this.event.next:
        condition = currentScroll >= scrollVal - clientVal - 16;
        scrollToLast = 0;
        scrollToNext = currentScroll + size;

        break;
    }

    scrollToVal = condition && this.infinite ? scrollToLast : scrollToNext;

    return scrollToVal;
  }

  // hide all controls if viewport is bigger than the width of all slides
  hideControls() {
    if (!this.navi) return false;

    const clientX = this.wrap.clientWidth,
          scrollX = this.wrap.scrollWidth;

    if (clientX === scrollX) {
      this.navi?.classList.add(this.modifiers.hidden)
      this.navi?.parentElement.classList.remove(this.modifiers.controls)
    } else {
      this.navi?.classList.remove(this.modifiers.hidden)
      this.navi?.parentElement.classList.add(this.modifiers.controls)
    }
  }

  scrollTo(options) {
    const { element, left, top } = options;

    element.scrollTo({
      left: left,
      top: top,
      behavior: "smooth",
    })
  }

  getSiblingElement(element, selector, direction) {
    if (!element) return false;

    let sibling;

    switch (direction) {
      case this.event.prev:
        sibling = element.previousElementSibling;

        while (sibling) {
          if (sibling.matches(selector)) return sibling.firstElementChild;
          sibling = sibling.previousElementSibling;
        }

        break;
    }
  }
}

const initCarousel = (el = ".carousel") => {
  const nodes = document.querySelectorAll(el);

  if (!nodes.length) return false;

  nodes.forEach(node => {
    const carousel = new Carousel(node);
    carousel.init();
  })
}

document.addEventListener("readystatechange", (e) => {
  if (e.target.readyState === "complete") initCarousel();
})
