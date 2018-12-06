import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[appFollowCursor]'
})
export class FollowCursorDirective {

  @Input()
  follower: HTMLElement;

  /**
   * Construct the component.
   * @param ele The element reference
   */
  constructor(private ele: ElementRef<HTMLElement>) { }

  /**
   * Follow the mouse move.
   * @param $event the mouse event
   */
  @HostListener('mousemove', ['$event'])
  onMouseMove($event) {

    if (this.follower && !this.follower.hidden && $event.target === this.ele.nativeElement) {
      const offsetParent = this.ele.nativeElement.offsetParent;
      const style = this.follower.style;
      style.left = ($event.layerX + 10 + offsetParent.scrollLeft) + 'px';
      style.top = ($event.layerY - 10 + offsetParent.scrollTop) + 'px';
      style.display = 'flex';
    }
  }

  /**
   * Stop following the mouse move.
   * @param $event the mouse event
   */
  @HostListener('mouseleave', ['$event'])
  @HostListener('click', ['$event'])
  onMouseLeave($event) {
    if (this.follower && $event.target === this.ele.nativeElement) {
      this.follower.style.display = 'none';
    }
  }

}
