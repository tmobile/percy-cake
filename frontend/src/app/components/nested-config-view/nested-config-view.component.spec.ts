import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NestedConfigViewComponent } from './nested-config-view.component';

describe('NestedConfigViewComponent', () => {
  let component: NestedConfigViewComponent;
  let fixture: ComponentFixture<NestedConfigViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NestedConfigViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NestedConfigViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
