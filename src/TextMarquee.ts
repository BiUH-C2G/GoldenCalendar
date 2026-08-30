interface MarqueeState {
  animation: Animation
  fadeFrame: number
  duration: number
  leaveLeft: number
  reachRight: number
}

export class TextMarquee {
  private readonly root: HTMLElement
  private readonly measureLayer = document.createElement('div')
  private readonly states = new Map<HTMLElement, MarqueeState>()
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly resizeObserver: ResizeObserver
  private refreshFrame = 0

  constructor(root: HTMLElement) {
    this.root = root
    this.measureLayer.className = 'measure-copy'
    this.measureLayer.setAttribute('aria-hidden', 'true')
    document.body.append(this.measureLayer)
    this.resizeObserver = new ResizeObserver(() => this.scheduleRefresh())
    this.resizeObserver.observe(root)
    this.reducedMotion.addEventListener('change', this.scheduleRefresh)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.refresh()
  }

  refresh = () => {
    cancelAnimationFrame(this.refreshFrame)
    this.refreshFrame = 0
    this.stopAllFields()
    this.root.querySelectorAll<HTMLElement>('[data-marquee]').forEach((viewport) => this.fitField(viewport))
    this.measureLayer.replaceChildren()
  }

  scheduleRefresh = () => {
    cancelAnimationFrame(this.refreshFrame)
    this.refreshFrame = requestAnimationFrame(this.refresh)
  }

  dispose() {
    cancelAnimationFrame(this.refreshFrame)
    this.resizeObserver.disconnect()
    this.reducedMotion.removeEventListener('change', this.scheduleRefresh)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.stopAllFields()
    this.measureLayer.remove()
  }

  private fitField(viewport: HTMLElement) {
    const track = viewport.firstElementChild as HTMLElement | null
    if (!track) return
    this.resetField(viewport, track)
    const available = viewport.clientWidth
    if (available <= 0) return
    const target = Math.ceil(this.widthNeededForLines(track, available, Number(viewport.dataset.maxLines) || 1))
    if (target <= available + 3) return
    track.style.width = `${target}px`
    track.style.minWidth = `${target}px`
    viewport.setAttribute('aria-description', `${viewport.dataset.fieldLabel ?? '文本'}较长，可查看完整内容`)
    if (this.reducedMotion.matches) {
      viewport.classList.add('is-manual-scroll')
      return
    }
    this.startField(viewport, track, target - available)
  }

  private widthNeededForLines(source: HTMLElement, startWidth: number, maxLines: number) {
    const allowedHeight = this.lineHeight(source) * maxLines + 1.5
    if (this.measureWrappedHeight(source, startWidth) <= allowedHeight) return startWidth
    let low = startWidth
    let high = Math.max(startWidth, this.measureNaturalWidth(source))
    while (high - low > 3) {
      const middle = Math.ceil((low + high) / 2)
      if (this.measureWrappedHeight(source, middle) <= allowedHeight) high = middle
      else low = middle
    }
    return high
  }

  private lineHeight(element: HTMLElement) {
    const style = getComputedStyle(element)
    const value = Number.parseFloat(style.lineHeight)
    return Number.isFinite(value) ? value : Number.parseFloat(style.fontSize) * 1.3
  }

  private measureWrappedHeight(source: HTMLElement, width: number) {
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.cssText = `width:${width}px;max-width:none;min-width:0;display:block;-webkit-line-clamp:unset;overflow:visible;position:static`
    this.measureLayer.replaceChildren(clone)
    return clone.getBoundingClientRect().height
  }

  private measureNaturalWidth(source: HTMLElement) {
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.cssText = 'width:max-content;max-width:none;min-width:0;display:block;-webkit-line-clamp:unset;overflow:visible;white-space:nowrap;overflow-wrap:normal;word-break:normal;position:static'
    this.measureLayer.replaceChildren(clone)
    return Math.ceil(clone.getBoundingClientRect().width)
  }

  private resetField(viewport: HTMLElement, track: HTMLElement) {
    viewport.classList.remove('is-marquee', 'is-manual-scroll', 'has-hidden-left', 'has-hidden-right')
    viewport.removeAttribute('aria-description')
    viewport.scrollLeft = 0
    track.style.width = '100%'
    track.style.minWidth = '100%'
    track.style.transform = 'translate3d(0,0,0)'
  }

  private stopAllFields() {
    this.states.forEach((state) => {
      state.animation.cancel()
      cancelAnimationFrame(state.fadeFrame)
    })
    this.states.clear()
  }

  private startField(viewport: HTMLElement, track: HTMLElement, distance: number) {
    const speed = viewport.dataset.fieldLabel === '课名' ? 13 : 11
    const dwell = 900
    const travel = Math.max(2600, Math.round(distance / speed * 1000))
    const duration = travel + dwell * 2
    const leaveLeft = dwell / duration
    const reachRight = (dwell + travel) / duration
    viewport.classList.add('is-marquee', 'has-hidden-right')
    const animation = track.animate([{ transform: 'translate3d(0,0,0)', offset: 0 }, { transform: 'translate3d(0,0,0)', offset: leaveLeft }, { transform: `translate3d(${-distance}px,0,0)`, offset: reachRight }, { transform: `translate3d(${-distance}px,0,0)`, offset: 1 }], { duration, iterations: Infinity, direction: 'alternate', easing: 'linear', fill: 'both' })
    const state = { animation, fadeFrame: 0, duration, leaveLeft, reachRight }
    this.states.set(viewport, state)
    this.syncFades(viewport, state)
  }

  private syncFades(viewport: HTMLElement, state: MarqueeState) {
    if (this.states.get(viewport) !== state || document.hidden) return
    const time = Number(state.animation.currentTime) || 0
    let local = time % (state.duration * 2) / state.duration
    if (local > 1) local = 2 - local
    const progress = local <= state.leaveLeft ? 0 : local >= state.reachRight ? 1 : (local - state.leaveLeft) / (state.reachRight - state.leaveLeft)
    viewport.classList.toggle('has-hidden-left', progress > .012)
    viewport.classList.toggle('has-hidden-right', progress < .988)
    state.fadeFrame = requestAnimationFrame(() => this.syncFades(viewport, state))
  }

  private handleVisibilityChange = () => {
    this.states.forEach((state, viewport) => {
      cancelAnimationFrame(state.fadeFrame)
      if (document.hidden) state.animation.pause()
      else {
        state.animation.play()
        this.syncFades(viewport, state)
      }
    })
  }
}
