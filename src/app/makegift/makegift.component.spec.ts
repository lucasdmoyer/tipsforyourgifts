import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MakegiftComponent } from './makegift.component';

describe('MakegiftComponent', () => {
  let component: MakegiftComponent;
  let fixture: ComponentFixture<MakegiftComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MakegiftComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MakegiftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
