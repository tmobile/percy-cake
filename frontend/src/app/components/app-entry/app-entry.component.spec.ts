import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppEntryComponent } from './app-entry.component';

describe('AppEntryComponent', () => {
  let component: AppEntryComponent;
  let fixture: ComponentFixture<AppEntryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AppEntryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
