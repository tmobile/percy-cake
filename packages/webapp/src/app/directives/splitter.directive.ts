/** ========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
=========================================================================== 
*/

import {
  Directive,
  Input,
  OnDestroy,
  OnInit,
  ElementRef,
  Output,
  EventEmitter
} from "@angular/core";

import { Subject, Subscription } from "rxjs";

import Split from "split.js";

@Directive({
  selector: "[appSplit]"
})
export class SplitDirective implements OnDestroy {
  @Input() private gutterHeight: number;
  @Input() private gutterWidth: number;
  @Input() private splitDirection = "horizontal";
  @Input() private splitFlexLayout = false;

  @Output() splitDrag = new EventEmitter<any>();

  private areas = [];
  private build$ = new Subject<boolean>();
  private sub: Subscription;

  /**
   * Constructor.
   */
  constructor() {
    this.sub = this.build$.subscribe(() => this.split());
  }

  /**
   * Add area.
   * @param area the split area to add
   */
  public addArea(area) {
    this.areas.push(area);
    this.build$.next(true);
  }

  /**
   * Split areas.
   */
  private split() {
    if (this.areas.length < 2) {
      // At least 2 areas needed to split
      return;
    }

    const options = this.getOptions();
    options.sizes = this.areas.map(area => area.size);
    options.minSize = this.areas.map(area => area.minSize || 0);

    Split(this.areas.map(area => area.element), options);
  }

  /**
   * Get options.
   * @returns options
   */
  private getOptions() {
    const options: any = { direction: this.splitDirection, snapOffset: 0 };

    if (this.gutterHeight || this.gutterWidth) {
      const gutterStyles: any = {};
      if (this.gutterHeight) {
        if (this.splitDirection === "vertical") {
          options.gutterSize = this.gutterHeight;
        }
        gutterStyles.height = this.gutterHeight + "px";
      }
      if (this.gutterWidth) {
        if (this.splitDirection === "horizontal") {
          options.gutterSize = this.gutterWidth;
        }
        gutterStyles.width = this.gutterWidth + "px";
      }
      options.gutterStyle = () => gutterStyles;
    }

    if (this.splitFlexLayout) {
      options.elementStyle = function(_dimension, size, gutterSize) {
        return {
          "flex-basis": "calc(" + size + "% - " + gutterSize + "px)"
        };
      };
    }

    options.onDrag = () => {
      this.splitDrag.emit();
    };
    return options;
  }

  /**
   * Destroy the component.
   */
  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}

@Directive({
  selector: "[appSplitArea]"
})
export class SplitAreaDirective implements OnInit {
  @Input() splitSize: number;
  @Input() minSize: number;

  /**
   * Constructor.
   * @param split The parent split directive
   * @param el The element reference to this area
   */
  constructor(private split: SplitDirective, private el: ElementRef) {}

  /**
   * Initialize the component.
   */
  public ngOnInit() {
    const element = this.el.nativeElement;
    const getBoundingClientRect$ = element.getBoundingClientRect;

    let first = true;
    element.getBoundingClientRect = () => {
      if (first) {
        // First call to getBoundingClientRect is used to align min size
        // , we'll ensure our min size is used
        first = false;
        return {
          height: this.minSize,
          width: this.minSize
        };
      }
      return getBoundingClientRect$.apply(element);
    };

    // Add this area to split
    this.split.addArea({
      size: this.splitSize,
      minSize: this.minSize,
      element
    });
  }
}
