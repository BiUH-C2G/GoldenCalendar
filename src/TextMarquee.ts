interface MarqueeState {
  animation: Animation
  viewport: HTMLElement
  track: HTMLElement
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
    this.states.forEach((state) => state.animation.cancel())
    this.states.clear()
    this.measureLayer.remove()
  }

  private fitField(viewport: HTMLElement) {
    const track = viewport.firstElementChild as HTMLElement | null
    if (!track) return
    this.stopField(viewport, track)
    const available = viewport.clientWidth
    if (available <= 0) return
    const target = Math.ceil(this.widthNeededForLines(track, available, Number(viewport.dataset.maxLines) || 1))
    if (target <= available + 3) return
    track.style.width = `${target}px`
    track.style.minWidth = `${target}px`
    viewport.setAttribute('aria-description', `${viewport.dataset.fieldLabel ?? '文本'}较长，将自动左右移动以显示完整内容`)
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
    clone.style.cssText = `width:${width}px;max-width:none;min-width:0;display:block;-webkit-line-clamp:unset;overflow:visible;position:static;`
    this.measureLayer.replaceChildren(clone)
    return clone.getBoundingClientRect().height
  }

  private measureNaturalWidth(source: HTMLElement) {
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.cssText = 'width:max-content;max-width:none;min-width:0;display:block;-webkit-line-clamp:unset;overflow:visible;white-space:nowrap;overflow-wrap:normal;word-break:normal;position:static;'
    this.measureLayer.replaceChildren(clone)
    return Math.ceil(clone.getBoundingClientRect().width)
  }

  private stopField(viewport: HTMLElement, track: HTMLElement) {
    const state = this.states.get(viewport)
    state?.animation.cancel()
    this.states.delete(viewport)
    viewport.classList.remove('is-marquee', 'has-hidden-left', 'has-hidden-right')
    viewport.removeAttribute('aria-description')
    track.style.width = '100%'
    track.style.minWidth = '100%'
    track.style.transform = 'translate3d(0,0,0)'
  }

  private startField(viewport: HTMLElement, track: HTMLElement, distance: number) {
    viewport.classList.add('has-hidden-right')
    if (this.reducedMotion.matches) return
    const speed = viewport.dataset.fieldLabel === '课名' ? 13 : 11
    const dwell = 900
    const travel = Math.max(2600, Math.round(distance / speed * 1000))
    const duration = travel + dwell * 2
    const leaveLeft = dwell / duration
    const reachRight = (dwell + travel) / duration
    viewport.classList.add('is-marquee')
    const animation = track.animate([{ transform: 'translate3d(0,0,0)', offset: 0 }, { transform: 'translate3d(0,0,0)', offset: leaveLeft }, { transform: `translate3d(${-distance}px,0,0)`, offset: reachRight }, { transform: `translate3d(${-distance}px,0,0)`, offset: 1 }], { duration, iterations: Infinity, direction: 'alternate', easing: 'linear', fill: 'both' })
    animation.onfinish = () => this.states.delete(viewport)
    this.states.set(viewport, { animation, viewport, track })
    const syncFades = () => {
      if (!this.states.has(viewport) || document.hidden) return
      const time = Number(animation.currentTime) || 0
      let local = time % (duration * 2) / duration
      if (local > 1) local = 2 - local
      const progress = local <= leaveLeft ? 0 : local >= reachRight ? 1 : (local - leaveLeft) / (reachRight - leaveLeft)
      viewport.classList.toggle('has-hidden-left', progress > .012)
      viewport.classList.toggle('has-hidden-right', progress < .988)
      requestAnimationFrame(syncFades)
    }
    requestAnimationFrame(syncFades)
  }

  private handleVisibilityChange = () => {
    this.states.forEach((state) => document.hidden ? state.animation.pause() : state.animation.play())
  }
}
