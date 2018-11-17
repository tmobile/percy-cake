import { Directive, Input, ElementRef, OnChanges } from '@angular/core';

import * as _ from 'lodash';

@Directive({
  selector: '[appResizable]'
})
export class ResizableDirective implements OnChanges {

  @Input()
  resizeToWidth: number | null;
  @Input()
  resizeToHeight: number | null;

  constructor(private el: ElementRef) {}

  ngOnChanges() {
    if (_.isNumber(this.resizeToWidth)) {
      this.el.nativeElement.style.width = this.resizeToWidth + 'px';
    } else {
      this.el.nativeElement.style.width = '';
    }
    if (_.isNumber(this.resizeToHeight)) {
      this.el.nativeElement.style.height = this.resizeToHeight + 'px';
    } else {
      this.el.nativeElement.style.height = '';
    }
  }
}
